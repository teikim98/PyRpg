"""누리 초상화(64×64, 표정 5종) — 농장 생활 게임풍 흉상 초상화의 화풍을 빌린 도트(디자인은 누리 고유).

화풍: 재질마다 4~6단계 램프(그늘은 적자주 쪽, 밝은 쪽은 노랑 쪽으로 색상을 비튼다), 순수 검정 대신
재질별 색 외곽선, 큰 덩어리로 나눈 머리카락 다발과 가닥 모양 광택, 2~3톤 홍채와 밝은 반사광.
빛은 언제나 왼쪽 위에서 온다.

몸통·머리카락·고글·망토는 한 번 그려 모든 표정이 공유하고, 표정마다 눈썹·눈·입·홍조·효과만
바꿔 얹는다(design.md §3 공통).

그리는 순서
1) 기하: 재질(머리카락·피부·망토…)과 음영 정보를 픽셀마다 기록한다. 머리카락은 정수리 덩어리(구 음영)
   위에 옆머리·앞머리·포니테일 다발(두께가 변하는 스플라인)을 겹친다.
2) 음영: 재질 램프(nuripal.COLORS)로 색을 정한다. 다발은 그늘 쪽 가장자리·끝을 한 단계 어둡게,
   겹친 다발 아래에는 그림자 선을, 빛 쪽 가운데에는 광택 가닥을 넣는다. 외톨이 픽셀은 정리한다.
3) 표정 조각과 소품(리본·머리핀)을 얹고, 마지막으로 재질별 색 외곽선을 두른다.

작업 캔버스는 너비 67(가운데 축 x=32)이고, 포니테일이 들어갈 자리를 오른쪽에 두려고
마지막에 왼쪽 3칸을 잘라 64×64로 만든다(얼굴 축은 결과 그림에서 x=29).

누리: 주황 하이 포니테일(청록 리본), 정수리 바보털, 이마에 올린 황동 고글(청록 렌즈), 왼쪽 옆머리의
나침반 장미 머리핀, 초록 눈, 어깨를 덮는 짧은 올리브 망토(황동 걸쇠), 왼쪽 어깨 뒤의 지도통,
가슴을 가로지르는 가죽 끈과 거기 매달린 황동 나침반.
"""
import math

from nuripal import CH

N = 64          # 결과 크기
W = 67          # 작업 캔버스 너비
XO = 3          # 결과로 자를 때 왼쪽에서 버리는 칸 수
_L = (-0.52, -0.62, 0.59)
_ln = math.sqrt(sum(c * c for c in _L))
LIGHT = tuple(c / _ln for c in _L)

HAIR = ("h0", "h1", "h2", "h3", "h4", "h5", "h6")
OUTLINE = {"hair": "ol_hair", "skin": "ol_skin", "cape": "ol_cape"}
D4 = ((1, 0), (-1, 0), (0, 1), (0, -1))


def _spline(pts, steps=8):
    """Catmull-Rom 스플라인으로 (x, y, w) 점들을 촘촘하게."""
    P = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for s in range(steps):
            t = s / steps
            out.append(tuple(
                0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t
                       + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t ** 3)
                for k in range(3)))
    out.append(tuple(pts[-1]))
    return out


def _sweep(pts, steps=8):
    """두께가 변하는 선(스플라인) 안의 픽셀 → {(x, y): (u, t, 단면 방향 px, py)}."""
    S = _spline(pts, steps)
    segs = []
    total = 0.0
    for a, b in zip(S, S[1:]):
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        if L > 1e-6:
            segs.append((a, b, L, total))
            total += L
    wmax = max(p[2] for p in S)
    x0 = int(min(p[0] for p in S) - wmax)
    x1 = int(max(p[0] for p in S) + wmax) + 1
    y0 = int(min(p[1] for p in S) - wmax)
    y1 = int(max(p[1] for p in S) + wmax) + 1
    out = {}
    for y in range(max(0, y0), min(N, y1 + 1)):
        for x in range(max(0, x0), min(W, x1 + 1)):
            px, py = x + 0.5, y + 0.5
            best = None
            for a, b, L, acc in segs:
                dx, dy = (b[0] - a[0]) / L, (b[1] - a[1]) / L
                s = max(0.0, min(L, (px - a[0]) * dx + (py - a[1]) * dy))
                qx, qy = a[0] + dx * s, a[1] + dy * s
                d = math.hypot(px - qx, py - qy)
                w = a[2] + (b[2] - a[2]) * s / L
                score = d - w / 2
                if best is None or score < best[0]:
                    cross = dx * (py - a[1]) - dy * (px - a[0])
                    best = (score, d, w, cross, dx, dy, (acc + s) / total)
            if best and best[0] <= 0:
                _, d, w, cross, dx, dy, t = best
                u = (d / (w / 2)) * (1 if cross >= 0 else -1) if w > 0 else 0.0
                out[(x, y)] = (max(-1.0, min(1.0, u)), t, -dy, dx)
    return out


class Geo:
    """1단계 기하: 픽셀마다 (재질, 그린 순서, 음영 정보)."""

    def __init__(self):
        self.mat = [[None] * W for _ in range(N)]
        self.info = [[None] * W for _ in range(N)]
        self.order = [[-1] * W for _ in range(N)]
        self.n = 0

    def _set(self, x, y, mat, info):
        if 0 <= x < W and 0 <= y < N:
            self.mat[y][x] = mat
            self.info[y][x] = info
            self.order[y][x] = self.n

    def fill(self, inside, mat, info=None):
        self.n += 1
        for y in range(N):
            for x in range(W):
                if inside(x + 0.5, y + 0.5):
                    self._set(x, y, mat, dict(info or {}))

    def strand(self, pts, mat="hair", steps=8, **extra):
        self.n += 1
        for (x, y), (u, t, px, py) in _sweep(pts, steps).items():
            self._set(x, y, mat, dict(u=u, t=t, px=px, py=py, sid=self.n, **extra))

    def m(self, x, y):
        return self.mat[y][x] if 0 <= x < W and 0 <= y < N else None

    def i(self, x, y):
        return (self.info[y][x] or {}) if 0 <= x < W and 0 <= y < N else {}

    def region(self, *mats):
        return {(x, y) for y in range(N) for x in range(W) if self.mat[y][x] in mats}


def _sphere(x, y, cx=31.0, cy=22.0, r=26.0):
    nx, ny = (x + 0.5 - cx) / r, (y + 0.5 - cy) / r
    nz = math.sqrt(max(0.08, 1 - nx * nx - ny * ny))
    ln = math.sqrt(nx * nx + ny * ny + nz * nz)
    return (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / ln


def _face_hw(yc):
    """얼굴 반폭(가운데 축 x=32.0). 넓고 둥근 볼, 작고 둥근 턱."""
    if yc < 13 or yc > 50.6:
        return -1.0
    if yc <= 37:
        return 15.6 * math.sqrt(max(0.0, 1 - ((yc - 37) / 25) ** 2))
    t = (yc - 37) / 13.6
    return 15.6 * max(0.0, 1 - t ** 2.3) ** 0.5 * (1 - 0.3 * t)


def _mirror_pts(pts):
    return [(64 - x, y, w) for x, y, w in pts]


# ── 1) 기하 ──────────────────────────────────────────────────────────────────
TAIL = [
    [(47, 8, 6), (53, 4.2, 7), (59, 5.6, 8), (63, 12, 8), (64.6, 21, 7), (64, 30, 5.6), (62, 38, 3.6), (59.6, 43.5, 1.0)],
    [(48, 9.5, 5), (54, 8, 6), (59, 12, 6.5), (60.4, 20, 6), (59.8, 28, 4.6), (58, 35, 2.2), (56.6, 38.4, 0.6)],
]
SIDE_L = [
    [(17, 15, 7), (13.6, 25, 7.5), (12.6, 35, 6.5), (13.4, 44, 4.6), (15.8, 50.6, 1.2)],
    [(20.5, 17, 5), (18.4, 27, 5), (17.6, 36, 3.6), (18.2, 42, 1.0)],
]
# (뿌리 x, 뿌리 y, 굵기, 끝 y, 끝 x)
BANGS = [
    (20.0, 16.0, 8.5, 28.0, 17.4),
    (25.0, 15.5, 9.0, 31.0, 22.6),
    (30.0, 15.0, 8.0, 28.0, 28.4),
    (34.6, 15.0, 8.0, 32.0, 34.6),
    (39.6, 15.5, 9.0, 30.0, 40.6),
    (44.4, 16.0, 8.0, 27.5, 46.6),
]


def _geometry():
    g = Geo()
    # 지도통(왼쪽 어깨 뒤로 비스듬히): 가죽 몸통 + 황동 뚜껑
    g.strand([(-2.0, 66, 6.0), (8.2, 47.4, 6.0)], mat="tube", steps=2)
    # 지도통 끝(통 방향에 수직인 타원 뚜껑)
    ax, ay = 0.48, -0.88
    for (rx, ry), part in (((3.6, 2.0), "ring"), ((2.1, 1.0), "paper")):
        g.fill(lambda x, y, rx=rx, ry=ry: ((x - 8.4) * ay - (y - 47.0) * ax) ** 2 / rx ** 2
               + ((x - 8.4) * ax + (y - 47.0) * ay) ** 2 / ry ** 2 <= 1, "tubecap", dict(part=part))

    # 포니테일(머리 뒤 오른쪽 위에서 올라갔다가 흘러내림)
    for pts in TAIL:
        g.strand(pts, part="tail")

    # 뒷머리(얼굴 뒤로 보이는 머리 안쪽)
    g.fill(lambda x, y: ((x - 32) / 20.5) ** 2 + ((y - 28) / 22) ** 2 <= 1 and y < 50, "hair", dict(back=True))

    # 목
    g.fill(lambda x, y: 28.0 <= x <= 36.0 and 44 <= y <= 60, "skin", dict(neck=True))

    # 망토: 둥근 어깨, 가운데가 V자로 열리고 셔츠가 보인다
    g.fill(lambda x, y: y >= 51.2 + 0.0072 * (x - 32) ** 2 and 1.0 <= x <= 66.5, "cape")
    g.fill(lambda x, y: 51.5 <= y <= 61.0 and abs(x - 32) <= 4.2 - (y - 51.5) * 0.55, "shirt")
    # 옷깃(양쪽으로 접힌 깃)
    for sgn in (-1, 1):
        g.fill(lambda x, y, sgn=sgn: 51.6 <= y <= 57.6
               and 3.4 + (y - 51.6) * -0.1 <= (x - 32) * sgn <= 8.8 - (y - 51.6) * 0.62
               and (x - 32) * sgn >= 4.4 - (y - 51.6) * 0.5, "cape", dict(collar=sgn))

    # 얼굴
    g.fill(lambda x, y: abs(x - 32) <= _face_hw(y), "skin", dict(face=True))

    # 머리 윗부분(정수리 덩어리): 구 음영으로 칠한다
    g.fill(lambda x, y: ((x - 32) / 21.6) ** 2 + ((y - 25.5) / 22) ** 2 <= 1 and y < 31
           and (y < 17 or abs(x - 32) > _face_hw(y) - 1.5), "hair", dict(part="cap"))

    # 옆머리(관자놀이에서 턱 아래까지, 끝이 안쪽으로 살짝 말린다)
    for pts in SIDE_L:
        g.strand(pts, part="side")
    for pts in SIDE_L:
        g.strand(_mirror_pts(pts), part="side")

    # 앞머리: 정수리에서 이마로 내려오는 뾰족한 다발들(길이를 엇갈리게)
    for x0, y0, w, ty, tx in BANGS:
        mx = (x0 + tx) / 2 + (0.5 if tx > 32 else -0.5)
        g.strand([(32 + (x0 - 32) * 0.7, 7.0, w * 0.9), (x0, y0, w), (mx, (y0 + ty) / 2 + 1, w * 0.72), (tx, ty, 0.6)],
                 part="bang")

    # 바보털
    g.strand([(33.6, 6.0, 3.0), (33.0, 2.4, 2.8), (30.6, 0.4, 2.4), (27.6, 0.6, 1.8), (26.2, 2.6, 0.6)], part="ahoge")

    # 고글 끈(머리를 감싸는 곡선)
    g.fill(lambda x, y: (abs(y - (13.8 + 0.011 * (x - 32) ** 2)) <= 1.55
                         and ((x - 32) / 21.7) ** 2 + ((y - 25.5) / 22.1) ** 2 <= 1), "leather", dict(strap=True))
    # 고글: 황동 테 + 청록 렌즈(두 개), 가운데 다리
    for cx in GOGGLE_X:
        g.fill(lambda x, y, cx=cx: ((x - cx) / 5.6) ** 2 + ((y - GOGGLE_Y) / 4.9) ** 2 <= 1, "brass", dict(rim=cx))
        g.fill(lambda x, y, cx=cx: ((x - cx) / 3.7) ** 2 + ((y - GOGGLE_Y) / 3.1) ** 2 <= 1, "lens", dict(cx=cx))
    g.fill(lambda x, y: 30.4 <= x <= 33.6 and 12.0 <= y <= 14.6, "brass", dict(bridge=True))

    # 지도통 끈(왼쪽 어깨 → 오른쪽 아래)과 나침반
    g.strand([(9, 52.0, 3.6), (30, 58.0, 3.6), (56, 65.4, 3.6)], mat="leather", steps=4, belt=True)
    g.fill(lambda x, y: (x - COMPASS[0]) ** 2 + (y - COMPASS[1]) ** 2 <= 3.5 ** 2, "brass", dict(compass=True))
    # 망토 걸쇠
    g.fill(lambda x, y: (x - 32) ** 2 + ((y - 58.6) / 0.85) ** 2 <= 2.0 ** 2, "brass", dict(clasp=True))
    return g


GOGGLE_X = (25.2, 38.8)
GOGGLE_Y = 13.2
COMPASS = (40.5, 60.2)

# 정수리 덩어리 위의 다발 경계선(한 단계 어둡게)과 광택 가닥(밝게)
CAP_LINES = [
    [(27, 5.2, 1), (20.5, 8.5, 1), (15.5, 14, 1), (12.6, 21, 1)],
    [(22, 10, 1), (17.5, 15.5, 1), (15.6, 22, 1), (15.2, 28, 1)],
    [(37, 5.2, 1), (43.5, 8.5, 1), (48.5, 14, 1), (51.4, 21, 1)],
    [(42, 10, 1), (46.5, 15.5, 1), (48.4, 22, 1), (48.8, 28, 1)],
    [(33.5, 4.0, 1), (31.0, 6.6, 1), (29.6, 8.6, 1)],
    [(35.0, 4.4, 1), (38.0, 7.0, 1), (39.4, 8.6, 1)],
]
SHINE = [
    [(18.5, 8.6, 1.0), (21.6, 5.8, 1.6), (25.4, 4.2, 1.0)],
    [(26.8, 5.6, 1.0), (29.0, 4.2, 1.3), (31.0, 3.9, 0.7)],
    [(36.4, 4.6, 0.7), (38.6, 5.4, 1.1), (40.6, 6.8, 0.7)],
    [(16.4, 11.6, 0.9), (14.6, 15.0, 1.5), (13.4, 19.6, 0.8)],
]
# 다발 종류별 광택 가닥이 들어가는 길이 구간(t)
STREAK = {"bang": (0.2, 0.42), "side": (0.06, 0.3), "tail": (0.1, 0.42)}


# ── 2) 음영 ──────────────────────────────────────────────────────────────────
def _clean(lv, region):
    """외톨이 픽셀 정리: 상하좌우 이웃 3개 이상이 같은 값이면 그 값으로."""
    out = {p: v for p, v in lv.items()}
    for (x, y) in region:
        nb = [lv[(x + dx, y + dy)] for dx, dy in D4 if (x + dx, y + dy) in region]
        if len(nb) < 3:
            continue
        for v in set(nb):
            if v != lv[(x, y)] and nb.count(v) >= 3:
                out[(x, y)] = v
    return out


def _shade_hair(g, col):
    hair = g.region("hair")
    lv = {}
    for (x, y) in hair:
        inf = g.i(x, y)
        sph = _sphere(x, y)
        if inf.get("back"):
            lv[(x, y)] = 1 if sph < 0.3 else 2
            continue
        part = inf["part"]
        if part == "cap":
            L = 2 + (sph > 0.28) + (sph > 0.6)
            if sph < 0.05:
                L = 1
            lv[(x, y)] = L
            continue
        v = sph
        if part == "tail":
            v -= 0.1
        if part == "ahoge":
            v += 0.2
        if part == "side":
            v -= 0.06 + 0.22 * inf["t"]
        L = 2 + (v > 0.28) + (v > 0.6)
        u = inf["u"]
        if part == "tail":
            # 포니테일은 머리와 떨어진 덩어리라 다발 자체의 원기둥 음영을 쓴다
            nz = math.sqrt(max(0.0, 1 - u * u))
            cyl = u * (inf["px"] * LIGHT[0] + inf["py"] * LIGHT[1]) + nz * LIGHT[2]
            L = 2 + (cyl > 0.56) + (cyl > 0.86) - (inf["t"] > 0.7)
        side = u * (inf["px"] * LIGHT[0] + inf["py"] * LIGHT[1])  # >0이면 빛을 향한 가장자리
        if abs(u) > 0.55 and side < 0:
            L -= 1
        lo, hi = STREAK.get(part, (0, 0))
        if side > 0 and 0.08 < abs(u) < 0.62 and lo < inf["t"] < hi:
            L += 1
        if inf["t"] > 0.84:
            L -= 1
        lv[(x, y)] = max(1, min(5, L))
    # 겹친 다발 아래쪽에 그림자 선(위 다발 가장자리 바로 바깥)
    sep = dict(lv)
    for (x, y) in hair:
        o = g.order[y][x]
        for dx, dy in ((0, -1), (-1, 0), (1, 0)):
            q = (x + dx, y + dy)
            if q in hair and g.order[q[1]][q[0]] > o:
                up, me = g.i(*q), g.i(x, y)
                # 같은 앞머리끼리는 뿌리 쪽(이마 위)에선 선을 긋지 않아 큰 덩어리로 보이게 한다
                if up.get("part") == me.get("part") == "bang" and up["t"] < 0.42:
                    continue
                sep[(x, y)] = max(1, lv[(x, y)] - 1)
                break
    # 정수리 경계선
    for pts in CAP_LINES:
        for (x, y), (u, t, _, _) in _sweep(pts, 6).items():
            if (x, y) in hair and g.i(x, y).get("part") in ("cap", "bang") and t > 0.12:
                sep[(x, y)] = max(1, lv[(x, y)] - 1)
    lv = _clean(sep, hair)
    # 광택 가닥: 밝은 쪽은 h5, 가운데 굵은 곳은 h6
    for pts in SHINE:
        for (x, y), (u, t, _, _) in _sweep(pts, 6).items():
            if (x, y) in hair and g.i(x, y).get("part") in ("cap", "bang"):
                sp = _sphere(x, y)
                lv[(x, y)] = 6 if sp > 0.8 and abs(u) < 0.35 else (5 if sp > 0.5 else 4)
    for (x, y) in hair:
        inf = g.i(x, y)
        L = lv[(x, y)]
        col[y][x] = HAIR[L]
    # 그늘 쪽 윤곽 안쪽의 은은한 반사광(림 라이트): 오른쪽 가장자리 1픽셀을 한 단계 밝게
    for (x, y) in hair:
        inf = g.i(x, y)
        if inf.get("part") in ("cap", "side") and 12 <= y <= 40 and x > 40 \
                and g.m(x + 1, y) is None and g.m(x + 2, y) is None and col[y][x] in ("h1", "h2"):
            col[y][x] = HAIR[HAIR.index(col[y][x]) + 1]
    # 포니테일과 머리 사이 경계는 가장 어둡게
    for (x, y) in hair:
        if g.i(x, y).get("part") == "tail":
            for dx, dy in D4:
                q = (x + dx, y + dy)
                if q in hair and g.i(*q).get("part") != "tail":
                    col[y][x] = "h0"
                    break


def _shade_rest(g, col):
    m, i = g.m, g.i

    # 피부: 앞머리 그림자, 오른쪽 볼 그늘, 턱 아래, 목
    for (x, y) in g.region("skin"):
        if i(x, y).get("neck"):
            c = "s3"
            if any(i(x, y - k).get("face") for k in (1, 2)):
                c = "s2"
            if m(x + 1, y) != "skin" or m(x + 2, y) != "skin":
                c = "s2"
            if m(x - 1, y) != "skin" and not any(i(x, y - k).get("face") for k in (1, 2)):
                c = "s4" if y > 48 else c
            col[y][x] = c
            continue
        c = "s4"
        if m(x, y - 1) == "hair" or m(x, y - 2) == "hair":
            c = "s3"
        if m(x - 1, y) == "hair" or m(x + 1, y) == "hair" or m(x + 2, y) == "hair":
            c = "s3"
        if y > 24 and (m(x + 1, y) is None or m(x + 2, y) is None):
            c = "s3"
        if y > 44 and not i(x, y + 1).get("face"):
            c = "s3"
        if m(x, y - 1) == "hair" and m(x, y - 2) == "hair" and m(x + 1, y - 1) == "hair" and y > 20:
            c = "s2"
        col[y][x] = c

    # 망토
    for (x, y) in g.region("cape"):
        inf = i(x, y)
        c = "c3"
        if x > 46:
            c = "c2"
        if x < 10 and y > 58:
            c = "c2"
        if m(x, y - 1) != "cape" or m(x, y - 2) != "cape":
            c = "c4" if x < 44 else "c3"
        if "collar" in inf:
            if inf["collar"] < 0:
                c = "c4" if m(x - 1, y) != "cape" or m(x, y - 1) != "cape" else "c3"
            else:
                c = "c3" if m(x, y - 1) != "cape" else "c2"
        elif "collar" in i(x, y - 1):
            c = "c1"
        if (x, y) in CAPE_FOLDS:
            c = "c2" if x < 40 else "c1"
        if m(x, y - 1) == "leather" and i(x, y - 1).get("belt"):
            c = "c1" if x > 30 else "c2"
        col[y][x] = c

    for (x, y) in g.region("shirt"):
        c = "w3"
        if m(x - 1, y) == "cape" or m(x + 1, y) == "cape" or m(x, y - 1) == "skin":
            c = "w2"
        if m(x + 1, y) == "cape" and m(x + 2, y) == "cape":
            c = "w1"
        col[y][x] = c

    for (x, y) in g.region("leather"):
        c = "l2"
        if m(x, y - 1) != "leather":
            c = "l3"
        if m(x, y + 1) != "leather":
            c = "l1"
        if i(x, y).get("strap") and x > 44:
            c = "l1" if c != "l3" else "l2"
        col[y][x] = c
    for (x, y) in g.region("tube"):
        u = i(x, y)["u"]
        col[y][x] = "l3" if u < -0.4 else ("l1" if u > 0.35 else "l2")
        if y == 57:
            col[y][x] = "b3" if u < -0.4 else ("b1" if u > 0.35 else "b2")
    for (x, y) in g.region("tubecap"):
        # 황동 테 안에 말아 넣은 지도(크림색 종이와 말린 자국)
        if i(x, y)["part"] == "paper":
            col[y][x] = "w3" if i(x - 1, y).get("part") != "paper" else "w2"
            continue
        d = (x + 0.5 - 8.4) * -0.88 - (y + 0.5 - 47.0) * 0.48   # 뚜껑 긴 축 위치(왼쪽 위가 +)
        col[y][x] = "b4" if d > 1.4 else ("b3" if d > -1.0 else "b1")

    # 황동
    for (x, y) in g.region("brass"):
        inf = i(x, y)
        if "rim" in inf:
            dx, dy = x + 0.5 - inf["rim"], y + 0.5 - GOGGLE_Y
            v = -(dx * 0.6 + dy * 0.8) / 5.0
            c = "b4" if v > 0.45 else ("b3" if v > -0.3 else "b2")
            if any(m(x + a, y + b) == "lens" for a, b in D4):
                c = "b2" if v > 0 else "b1"
            if m(x, y + 1) not in ("brass", "lens"):
                c = "b1"
        elif inf.get("bridge"):
            c = "b4" if m(x, y - 1) != "brass" else ("b1" if m(x, y + 1) != "brass" else "b2")
        elif inf.get("compass"):
            dx, dy = x + 0.5 - COMPASS[0], y + 0.5 - COMPASS[1]
            if math.hypot(dx, dy) < 2.1:
                c = "w3" if dx + dy < 1 else "w2"
            else:
                c = "b4" if dx + dy < -2.5 else ("b3" if dx + dy < 1.5 else "b1")
        else:  # 걸쇠
            c = "b4" if m(x, y - 1) != "brass" and m(x - 1, y) != "brass" else "b3"
            if m(x, y + 1) != "brass" or m(x + 1, y) != "brass":
                c = "b1" if m(x, y + 1) != "brass" else "b2"
        col[y][x] = c
    cx, cy = int(COMPASS[0]), int(COMPASS[1])
    col[cy - 1][cx] = "red"
    col[cy][cx] = "red0"
    col[cy + 1][cx] = "w0"
    col[cy - 3][cx - 1] = "b5"

    # 렌즈: 위는 테 그림자로 어둡고 아래로 밝아짐, 왼쪽 위 반사광
    for (x, y) in g.region("lens"):
        dx, dy = x + 0.5 - i(x, y)["cx"], y + 0.5 - GOGGLE_Y
        c = "t2"
        if m(x, y - 1) != "lens":
            c = "t1"
        if dy > 0.8 and dx > -1.5:
            c = "t3"
        col[y][x] = c
    for gx in GOGGLE_X:
        x0 = int(gx - 2.2)
        col[11][x0] = "t4"
        col[12][x0] = "t4"
        col[11][x0 + 1] = "white"


CAPE_FOLDS = {(8, 59), (8, 60), (9, 61), (9, 62), (9, 63), (17, 61), (17, 62), (17, 63),
              (47, 59), (47, 60), (48, 61), (48, 62), (48, 63), (56, 60), (56, 61), (57, 62), (57, 63)}


def _stamp(col, text, x0, y0, legend, flip=False):
    for j, r in enumerate(_rows(text)):
        if flip:
            r = r[::-1]
        for k, ch in enumerate(r):
            if ch == ".":
                continue
            x, y = x0 + k, y0 + j
            if 0 <= x < W and 0 <= y < N:
                col[y][x] = legend[ch]


def _rows(text):
    return [r.strip() for r in text.strip("\n").splitlines() if r.strip()]


# 리본(청록 나비매듭, 포니테일 묶은 곳)과 나침반 장미 머리핀
RIBBON = """
aa.......aa
aca.....aba
adca...acba
adcca.accba
abccbdbccba
abbbadabbba
.aaabdbaaa.
...abaaba..
..aba..aba.
..aa....aa.
"""
RIBBON_L = {"a": "t0", "b": "t1", "c": "t2", "d": "t3", "e": "t4"}

CLIP = """
...a...
..aba..
.abcba.
abcdcba
.abcba.
..aba..
...a...
"""
CLIP_L = {"a": "b1", "b": "b3", "c": "b4", "d": "red"}


def _props(col):
    _stamp(col, RIBBON, 44, 1, RIBBON_L)
    _stamp(col, CLIP, 10, 27, CLIP_L)


# ── 3) 표정 ──────────────────────────────────────────────────────────────────
# 눈 10×9(왼눈 x=19~28, 오른눈은 좌우 반전해서 x=35~44). 반사광은 반전하지 않고 두 눈 모두 왼쪽 위에 둔다.
EYE_X, EYE_Y = 19, 31
BROW_X, BROW_Y = 20, 28
BLUSH_X, BLUSH_Y = 17, 40
MOUTH_Y = 45
FEAT = {
    "L": "lash", "l": "lash2", "W": "sc", "w": "sc1", "0": "e0", "1": "e1", "2": "e2", "3": "e3", "4": "e4",
    "*": "white", "k": "s2", "s": "s3", "b": "h0", "B": "lash2", "i": "bl1", "I": "bl0",
    "A": "m0", "M": "m1", "N": "m2", "T": "m3", "o": "s0", "a": "s1", "c": "t4", "t": "t3",
}

EYE_OPEN = """
...LLLLL..
LLLLLLLLLl
Lw111111W.
.W210012W.
.W220022W.
.W233332W.
.W334433W.
..344443..
...llll...
"""
CATCH = ((3, 2), (4, 2), (3, 3), (6, 6))

EXPR = {
    "neutral": dict(
        brow="""
            .bbbbbb.
            b.......
        """,
        eye=EYE_OPEN, catch=CATCH,
        mouth="""
            k....k
            .oooo.
        """,
        blush="""
            .iiii.
            ..ii..
        """,
    ),
    "happy": dict(
        brow="""
            .bbbbbb.
            b......b
        """, brow_dy=-1,
        eye="""
            ..........
            ..........
            ..........
            ...LLLL...
            .LLLLLLLL.
            LL......LL
            L........l
            ..........
            ..........
        """,
        mouth="""
            .AAAAAA.
            AMMMMMMA
            .AMNNMA.
            ..ANNA..
            ...AA...
        """, mouth_dy=-1,
        blush="""
            .iIIi.
            iiIIii
        """,
        fx=[("""
            ..y..
            ..Y..
            yYWYy
            ..Y..
            ..y..
        """, 3, 17), ("""
            .y.
            yWy
            .y.
        """, 5, 25)],
    ),
    "worried": dict(
        brow="""
            .....bbB
            bbbbb...
        """, brow_dy=-1,
        eye="""
            ..........
            ..LLLLLL..
            LLLLLLLLLl
            Lw111111W.
            .W210012W.
            .W233332W.
            .W334433W.
            ..cttttc..
            ...cccc...
        """, catch=((3, 3), (4, 3), (3, 4), (6, 6), (7, 5)),
        mouth="""
            ..oo..
            .o..o.
        """,
        fx=[("""
            ..t..
            .tct.
            tcccT
            tWccT
            tWccT
            .TTT.
        """, 51, 21)],
    ),
    "surprised": dict(
        brow="""
            .bbbbbb.
            b......b
        """, brow_dy=-2,
        eye="""
            ..LLLLLL..
            .LLLLLLLL.
            LWWWWWWWWl
            .WWW11WWW.
            .WW1001WW.
            .WW2002WW.
            .WW2332WW.
            .WWW44WWW.
            ..WWWWWW..
            ...llll...
        """, eye_dy=-1, catch=((3, 4),),
        mouth="""
            .AA.
            AMMA
            AMNA
            .AA.
        """,
        fx=[("""
            rr
            rr
            rr
            rr
            ..
            rr
        """, 7, 6)],
    ),
    "serious": dict(
        brow="""
            bbb.....
            ...bbbbB
        """, brow_dy=1,
        eye="""
            ..........
            ..........
            LLLLLLLLLl
            LL111111L.
            .W210012W.
            .W233332W.
            .W334433W.
            ..344443..
            ...llll...
        """, catch=((3, 4), (4, 4), (6, 6)),
        mouth="""
            aooa
        """, mouth_dy=1,
        blush="""
            ..ii..
            ......
        """,
    ),
}
FX = dict(FEAT, y="b4", Y="b5", t="t1", T="t2", c="t4", r="red")


def _face(col, expr):
    e = EXPR[expr]
    blush = e.get("blush", EXPR["neutral"]["blush"])
    w = len(_rows(blush)[0])
    _stamp(col, blush, BLUSH_X, BLUSH_Y, FEAT)
    _stamp(col, blush, 64 - BLUSH_X - w, BLUSH_Y, FEAT, flip=True)
    ew = len(_rows(e["eye"])[0])
    for x0, flip in ((EYE_X, False), (64 - EYE_X - ew, True)):
        ey = EYE_Y + e.get("eye_dy", 0)
        _stamp(col, e["eye"], x0, ey, FEAT, flip=flip)
        for cx, cy in e.get("catch", ()):
            col[ey + cy][x0 + cx] = "white"
    bw = len(_rows(e["brow"])[0])
    by = BROW_Y + e.get("brow_dy", 0)
    _stamp(col, e["brow"], BROW_X, by, FEAT)
    _stamp(col, e["brow"], 64 - BROW_X - bw, by, FEAT, flip=True)
    # 코: 그늘 1픽셀 + 밝은 콧등 1픽셀
    col[42][32] = "s2"
    mw = len(_rows(e["mouth"])[0])
    _stamp(col, e["mouth"], 32 - mw // 2, MOUTH_Y + e.get("mouth_dy", 0), FEAT)
    for text, x, y in e.get("fx", ()):
        _stamp(col, text, x, y, FX)


# ── 마무리 ───────────────────────────────────────────────────────────────────
def _outline(g, col):
    out = [r[:] for r in col]
    for y in range(N):
        for x in range(W):
            if col[y][x] is not None:
                continue
            for dx, dy in ((0, 1), (0, -1), (1, 0), (-1, 0)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < W and 0 <= ny < N and col[ny][nx] is not None:
                    out[y][x] = OUTLINE.get(g.mat[ny][nx], "ol")
                    break
    return out


def _base():
    g = _geometry()
    col = [[None] * W for _ in range(N)]
    _shade_hair(g, col)
    _shade_rest(g, col)
    _props(col)
    return g, col


GEO, BASE = _base()


def portrait(expr):
    col = [r[:] for r in BASE]
    _face(col, expr)
    col = _outline(GEO, col)
    return ["".join(CH[c] if c else "." for c in row[XO:XO + N]) for row in col]


EXPRS = ("neutral", "happy", "worried", "surprised", "serious")
PORTRAITS = {f"nuri_{k}": [portrait(k)] for k in EXPRS}
