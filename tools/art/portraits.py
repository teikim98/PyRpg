"""누리 초상화(64×64, 표정 5종) — 그래픽 개편 코지 화풍(docs/art-overhaul/style-guide.md §7).

화풍: 공통 코지 팔레트(cozypal)의 램프만 쓴다. 재질마다 3단(그늘·기본·밝음) + 강조(spec) 몇 픽셀,
그라데이션·구 음영 없이 평평한 덩어리로 칠하고, 바깥 외곽선은 닿은 재질의 ol(가장 어두운 것)이다.
빛은 왼쪽 위. 얼굴은 단순하게: 눈은 잉크 속눈썹 2줄 + 초록 홍채(위 1줄 그늘, 가운데 2×2 동공, 아래 밝음) + 반사광 2px,
입은 작은 선, 볼터치 한 줄. 홍채는 eye_green 낱색에 cloth_green 램프의 그늘·밝음을 빌려 3단을 만든다.

몸통·머리카락·고글·망토는 한 번 그려 모든 표정이 공유하고, 표정마다 눈썹·눈·입·볼터치·효과만
바꿔 얹는다(design.md §3 공통).

그리는 순서
1) 기하: 재질(머리카락·피부·망토…)과 형태 정보를 픽셀마다 기록한다. 머리카락은 정수리 덩어리 위에
   옆머리·앞머리·포니테일 다발(두께가 변하는 스플라인)을 겹친다.
2) 음영: 픽셀마다 코지 색 이름("hair_ginger.base" …)을 정한다. 덩어리마다 3단 + 강조.
3) 소품(리본·머리핀)과 표정 조각을 얹고, cozypal.auto_outline으로 재질 외곽선을 두른다.

작업 캔버스는 너비 67(가운데 축 x=32)이고, 포니테일이 들어갈 자리를 오른쪽에 두려고
마지막에 왼쪽 3칸을 잘라 64×64로 만든다(얼굴 축은 결과 그림에서 x=29).

누리: 주황 하이 포니테일(화면 오른쪽, 청록 리본), 정수리 바보털, 이마에 올린 황동 고글(청록 렌즈),
왼쪽 옆머리의 나침반 장미 머리핀, 초록 눈, 어깨를 덮는 짧은 올리브 망토(황동 걸쇠), 왼쪽 어깨 뒤의 지도통,
가슴을 가로지르는 가죽 끈과 거기 매달린 황동 나침반. 걷기 시트(characters.NURI)와 같은 램프를 쓴다.
"""
import math

from cozypal import auto_outline, c

N = 64          # 결과 크기
W = 67          # 작업 캔버스 너비
XO = 3          # 결과로 자를 때 왼쪽에서 버리는 칸 수
_L = (-0.52, -0.62, 0.59)
_ln = math.sqrt(sum(v * v for v in _L))
LIGHT = tuple(v / _ln for v in _L)
D4 = ((1, 0), (-1, 0), (0, 1), (0, -1))

# 재질 → 코지 램프(style-guide §7)
HAIR = "hair_ginger"
SKIN = "skin"
CAPE = "cloth_olive"
SHIRT = "cloth_white"
BRASS = "brass"
TEAL = "teal"
LEATHER = "leather"
STEP = ("ol", "shade", "base", "hi", "spec")


def _c(ramp, lv):
    return f"{ramp}.{STEP[lv]}"


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
    """1단계 기하: 픽셀마다 (재질, 그린 순서, 형태 정보)."""

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
# (뿌리 x, 뿌리 y, 굵기, 끝 y, 끝 x). 다발 수를 줄이고 굵게 해서 큰 덩어리로 읽히게 한다
BANGS = [
    (20.0, 16.0, 9.0, 28.0, 17.4),
    (26.0, 15.5, 10.0, 31.0, 23.6),
    (33.0, 15.0, 9.5, 30.0, 32.6),
    (39.6, 15.5, 10.0, 31.0, 40.6),
    (44.4, 16.0, 8.5, 27.5, 46.6),
]
GOGGLE_X = (25.2, 38.8)
GOGGLE_Y = 13.2
COMPASS = (40.5, 60.2)


def _geometry():
    g = Geo()
    # 지도통(왼쪽 어깨 뒤로 비스듬히): 가죽 몸통 + 황동 뚜껑
    g.strand([(-2.0, 66, 6.0), (8.2, 47.4, 6.0)], mat="tube", steps=2)
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
    for sgn in (-1, 1):
        g.fill(lambda x, y, sgn=sgn: 51.6 <= y <= 57.6
               and 3.4 + (y - 51.6) * -0.1 <= (x - 32) * sgn <= 8.8 - (y - 51.6) * 0.62
               and (x - 32) * sgn >= 4.4 - (y - 51.6) * 0.5, "cape", dict(collar=sgn))

    # 얼굴
    g.fill(lambda x, y: abs(x - 32) <= _face_hw(y), "skin", dict(face=True))

    # 머리 윗부분(정수리 덩어리)
    g.fill(lambda x, y: ((x - 32) / 21.6) ** 2 + ((y - 25.5) / 22) ** 2 <= 1 and y < 31
           and (y < 17 or abs(x - 32) > _face_hw(y) - 1.5), "hair", dict(part="cap"))

    # 옆머리
    for pts in SIDE_L:
        g.strand(pts, part="side")
    for pts in SIDE_L:
        g.strand(_mirror_pts(pts), part="side")

    # 앞머리
    for x0, y0, w, ty, tx in BANGS:
        mx = (x0 + tx) / 2 + (0.5 if tx > 32 else -0.5)
        g.strand([(32 + (x0 - 32) * 0.7, 7.0, w * 0.9), (x0, y0, w), (mx, (y0 + ty) / 2 + 1, w * 0.72), (tx, ty, 0.6)],
                 part="bang")

    # 바보털
    g.strand([(33.6, 6.0, 3.0), (33.0, 2.4, 2.8), (30.6, 0.4, 2.4), (27.6, 0.6, 1.8), (26.2, 2.6, 0.6)], part="ahoge")

    # 고글 끈
    g.fill(lambda x, y: (abs(y - (13.8 + 0.011 * (x - 32) ** 2)) <= 1.55
                         and ((x - 32) / 21.7) ** 2 + ((y - 25.5) / 22.1) ** 2 <= 1), "leather", dict(strap=True))
    # 고글: 황동 테 + 청록 렌즈(두 개), 가운데 다리
    for cx in GOGGLE_X:
        g.fill(lambda x, y, cx=cx: ((x - cx) / 5.6) ** 2 + ((y - GOGGLE_Y) / 4.9) ** 2 <= 1, "brass", dict(rim=cx))
        g.fill(lambda x, y, cx=cx: ((x - cx) / 3.7) ** 2 + ((y - GOGGLE_Y) / 3.1) ** 2 <= 1, "lens", dict(cx=cx))
    g.fill(lambda x, y: 30.4 <= x <= 33.6 and 12.0 <= y <= 14.6, "brass", dict(bridge=True))

    # 지도통 끈(왼쪽 어깨 → 오른쪽 아래)과 나침반, 망토 걸쇠
    g.strand([(9, 52.0, 3.6), (30, 58.0, 3.6), (56, 65.4, 3.6)], mat="leather", steps=4, belt=True)
    g.fill(lambda x, y: (x - COMPASS[0]) ** 2 + (y - COMPASS[1]) ** 2 <= 3.5 ** 2, "brass", dict(compass=True))
    g.fill(lambda x, y: (x - 32) ** 2 + ((y - 58.6) / 0.85) ** 2 <= 2.0 ** 2, "brass", dict(clasp=True))
    return g


# 정수리 덩어리 위의 다발 경계선(그늘 1px)과 광택 띠(밝음, 가운데 몇 픽셀만 강조)
CAP_LINES = [
    [(27, 5.2, 1), (20.5, 8.5, 1), (15.5, 14, 1), (12.6, 21, 1)],
    [(37, 5.2, 1), (43.5, 8.5, 1), (48.5, 14, 1), (51.4, 21, 1)],
    [(33.5, 4.0, 1), (31.0, 6.6, 1), (29.6, 8.6, 1)],
]
SHINE = [
    [(17.6, 9.6, 1.0), (21.6, 5.8, 1.6), (25.4, 4.2, 1.0)],
    [(15.6, 12.6, 0.9), (14.4, 16.0, 1.3), (13.6, 19.6, 0.8)],
]
SPEC = ((21, 6), (22, 6), (14, 15))   # 광택 띠 위 강조 픽셀(3개)


# ── 2) 음영(3단 + 강조) ───────────────────────────────────────────────────────
def _clean(lv, region):
    """외톨이 픽셀 정리: 상하좌우 이웃 3개 이상이 같은 값이면 그 값으로."""
    out = dict(lv)
    for (x, y) in region:
        nb = [lv[(x + dx, y + dy)] for dx, dy in D4 if (x + dx, y + dy) in region]
        if len(nb) < 3:
            continue
        for v in set(nb):
            if v != lv[(x, y)] and nb.count(v) >= 3:
                out[(x, y)] = v
    return out


def _shade_hair(g, col):
    """머리카락: 1 그늘 · 2 기본 · 3 밝음 · 4 강조."""
    hair = g.region("hair")
    lv = {}
    for (x, y) in hair:
        inf = g.i(x, y)
        sph = _sphere(x, y)
        if inf.get("back"):
            lv[(x, y)] = 1
            continue
        part = inf["part"]
        if part == "tail":
            u = inf["u"]
            nz = math.sqrt(max(0.0, 1 - u * u))
            v = u * (inf["px"] * LIGHT[0] + inf["py"] * LIGHT[1]) + nz * LIGHT[2]
            L = 1 if v < 0.15 else (3 if v > 0.85 and inf["t"] < 0.45 else 2)
            if inf["t"] > 0.8:
                L = 1
            lv[(x, y)] = L
            continue
        v = sph
        if part == "ahoge":
            v += 0.25
        if part == "side":
            v -= 0.05 + 0.25 * inf["t"]
        L = 1 if v < -0.3 else (3 if v > 0.6 else 2)
        if part in ("bang", "side"):
            u = inf["u"]
            side = u * (inf["px"] * LIGHT[0] + inf["py"] * LIGHT[1])
            if abs(u) > 0.6 and side < 0:        # 다발의 그늘 쪽 가장자리
                L = 1
            if inf["t"] > 0.82:                  # 다발 끝
                L = min(L, 1 if part == "side" else 2)
        lv[(x, y)] = L
    # 겹친 다발 아래쪽에 그늘 선(위 다발 가장자리 바로 바깥)
    sep = dict(lv)
    for (x, y) in hair:
        o = g.order[y][x]
        for dx, dy in ((0, -1), (-1, 0), (1, 0)):
            q = (x + dx, y + dy)
            if q in hair and g.order[q[1]][q[0]] > o:
                up, me = g.i(*q), g.i(x, y)
                if up.get("part") == me.get("part") == "bang" and up["t"] < 0.5:
                    continue
                if me.get("back"):
                    continue
                sep[(x, y)] = 1
                break
    for pts in CAP_LINES:
        for (x, y), (u, t, _, _) in _sweep(pts, 6).items():
            if (x, y) in hair and g.i(x, y).get("part") in ("cap", "bang") and t > 0.15:
                sep[(x, y)] = 1
    lv = _clean(_clean(sep, hair), hair)
    for pts in SHINE:
        for (x, y), _ in _sweep(pts, 6).items():
            if (x, y) in hair and g.i(x, y).get("part") in ("cap", "bang"):
                lv[(x, y)] = 3
    for p in SPEC:
        lv[p] = 4
    for (x, y), L in lv.items():
        col[y][x] = _c(HAIR, L)
    # 포니테일 뿌리(머리와 닿는 곳)는 그늘
    for (x, y) in hair:
        if g.i(x, y).get("part") == "tail":
            if any((x + dx, y + dy) in hair and g.i(x + dx, y + dy).get("part") != "tail" for dx, dy in D4):
                col[y][x] = _c(HAIR, 1)


def _shade_rest(g, col):
    m, i = g.m, g.i

    # 피부: 기본은 밝음(hi), 앞머리·옆머리 아래와 오른쪽 볼은 기본(base), 턱 아래 목은 그늘(shade)
    for (x, y) in g.region("skin"):
        if i(x, y).get("neck"):
            lv = 2
            if any(i(x, y - k).get("face") for k in (1, 2)) or m(x + 1, y) != "skin" or m(x + 2, y) != "skin":
                lv = 1
            col[y][x] = _c(SKIN, lv)
            continue
        lv = 3
        if m(x, y - 1) == "hair" or m(x, y - 2) == "hair":
            lv = 2
        if m(x - 1, y) == "hair" or m(x + 1, y) == "hair" or m(x + 2, y) == "hair":
            lv = 2
        if y > 26 and (m(x + 1, y) is None or m(x + 2, y) is None):
            lv = 2
        if y > 45 and not i(x, y + 1).get("face"):
            lv = 2
        col[y][x] = _c(SKIN, lv)

    # 망토: 기본, 어깨 위 가장자리 밝음, 오른쪽·접힘·깃 아래 그늘
    for (x, y) in g.region("cape"):
        inf = i(x, y)
        lv = 2
        if x > 47 or (x < 9 and y > 58):
            lv = 1
        if m(x, y - 1) != "cape":
            lv = 3 if x < 46 else 2
        if "collar" in inf:
            if inf["collar"] < 0:
                lv = 3 if m(x - 1, y) != "cape" or m(x, y - 1) != "cape" else 2
            else:
                lv = 2 if m(x, y - 1) != "cape" else 1
        elif "collar" in i(x, y - 1):
            lv = 1
        if (x, y) in CAPE_FOLDS:
            lv = 1
        if m(x, y - 1) == "leather" and i(x, y - 1).get("belt"):
            lv = 1
        col[y][x] = _c(CAPE, lv)

    for (x, y) in g.region("shirt"):
        lv = 3
        if m(x + 1, y) == "cape" or m(x, y - 1) == "skin":
            lv = 2
        if m(x + 1, y) == "cape" and m(x + 2, y) == "cape":
            lv = 1
        col[y][x] = _c(SHIRT, lv)

    for (x, y) in g.region("leather"):
        lv = 2
        if m(x, y - 1) != "leather":
            lv = 3
        if m(x, y + 1) != "leather":
            lv = 1
        if i(x, y).get("strap") and x > 44:
            lv = 1 if lv != 3 else 2
        col[y][x] = _c(LEATHER, lv)
    for (x, y) in g.region("tube"):
        u = i(x, y)["u"]
        lv = 3 if u < -0.4 else (1 if u > 0.35 else 2)
        col[y][x] = _c(BRASS if y == 57 else LEATHER, lv)
    for (x, y) in g.region("tubecap"):
        if i(x, y)["part"] == "paper":
            col[y][x] = _c(SHIRT, 3 if i(x - 1, y).get("part") != "paper" else 2)
            continue
        d = (x + 0.5 - 8.4) * -0.88 - (y + 0.5 - 47.0) * 0.48
        col[y][x] = _c(BRASS, 3 if d > 0.6 else (2 if d > -1.4 else 1))

    # 황동
    for (x, y) in g.region("brass"):
        inf = i(x, y)
        if "rim" in inf:
            dx, dy = x + 0.5 - inf["rim"], y + 0.5 - GOGGLE_Y
            v = -(dx * 0.6 + dy * 0.8) / 5.0
            lv = 3 if v > 0.35 else 2
            if any(m(x + a, y + b) == "lens" for a, b in D4) and v < 0:
                lv = 1
            if m(x, y + 1) not in ("brass", "lens"):
                lv = 1
        elif inf.get("bridge"):
            lv = 3 if m(x, y - 1) != "brass" else (1 if m(x, y + 1) != "brass" else 2)
        elif inf.get("compass"):
            dx, dy = x + 0.5 - COMPASS[0], y + 0.5 - COMPASS[1]
            if math.hypot(dx, dy) < 2.1:
                col[y][x] = _c(SHIRT, 3)
                continue
            lv = 3 if dx + dy < -1.5 else (2 if dx + dy < 1.5 else 1)
        else:  # 걸쇠
            lv = 3 if m(x, y - 1) != "brass" and m(x - 1, y) != "brass" else 2
            if m(x, y + 1) != "brass" or m(x + 1, y) != "brass":
                lv = 1
        col[y][x] = _c(BRASS, lv)
    cx, cy = int(COMPASS[0]), int(COMPASS[1])
    col[cy - 1][cx] = "cloth_red.base"
    col[cy][cx] = "cloth_red.shade"
    col[cy + 1][cx] = _c(SHIRT, 1)
    col[cy - 3][cx - 1] = _c(BRASS, 4)

    # 렌즈: 위는 테 그림자(그늘), 가운데 기본, 오른쪽 아래 밝음, 왼쪽 위 반사광
    for (x, y) in g.region("lens"):
        dx, dy = x + 0.5 - i(x, y)["cx"], y + 0.5 - GOGGLE_Y
        lv = 2
        if m(x, y - 1) != "lens":
            lv = 1
        if dy > 0.8 and dx > -1.5:
            lv = 3
        col[y][x] = _c(TEAL, lv)
    for gx in GOGGLE_X:
        x0 = int(gx - 2.2)
        col[11][x0] = "eye_shine"
        col[12][x0] = _c(TEAL, 4)


CAPE_FOLDS = {(8, 59), (8, 60), (9, 61), (9, 62), (9, 63), (17, 61), (17, 62), (17, 63),
              (47, 59), (47, 60), (48, 61), (48, 62), (48, 63), (56, 60), (56, 61), (57, 62), (57, 63)}


def _rows(text):
    return [r.strip() for r in text.strip("\n").splitlines() if r.strip()]


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


# 리본(청록 나비매듭, 포니테일 묶은 곳)과 나침반 장미 머리핀
RIBBON = """
aa.......aa
aca.....aca
adca...acba
adcca.accba
acccbdbccba
abbbadabbba
.aaabdbaaa.
...abaaba..
..aba..aba.
..aa....aa.
"""
RIBBON_L = {"a": "teal.ol", "b": "teal.shade", "c": "teal.base", "d": "teal.hi"}

CLIP = """
...a...
..aba..
.abcba.
abcdcba
.abcba.
..aba..
...a...
"""
CLIP_L = {"a": "brass.shade", "b": "brass.base", "c": "brass.hi", "d": "cloth_red.base"}


def _props(col):
    _stamp(col, RIBBON, 44, 1, RIBBON_L)
    _stamp(col, CLIP, 10, 27, CLIP_L)


# ── 3) 표정 ──────────────────────────────────────────────────────────────────
# 눈 8×8(왼눈 x=19~26, 오른눈은 좌우 반전해서 x=37~44). 왼눈 그리드의 왼쪽이 바깥(눈꼬리) 쪽이다.
# 눈동자의 잉크는 2×2 동공뿐이고 나머지는 초록이라 3배·2배에서도 초록 눈으로 읽힌다. 놀람은 흰자 안의 작은 홍채.
# 반사광은 반전하지 않고 두 눈 모두 왼쪽 위(빛 방향)에 둔다(catch 좌표는 왼눈 기준, 오른눈은 같은 좌표).
EYE_X, EYE_Y = 19, 31
BROW_X, BROW_Y = 19, 27
BLUSH_X, BLUSH_Y = 17, 40
MOUTH_Y = 45
FEAT = {
    "L": "eye",                 # 속눈썹·윗눈꺼풀(잉크)
    "D": "eye",                 # 동공(잉크 2×2)
    "d": "cloth_green.shade",   # 홍채 위쪽(눈꺼풀 그늘)
    "G": "eye_green",           # 초록 홍채
    "g": "cloth_green.hi",      # 홍채 아래 밝은 초록
    "w": "cloth_white.hi",      # 흰자(놀람)
    "b": "hair_ginger.ol",      # 눈썹
    "B": "hair_ginger.shade",   # 눈썹 끝(옅게)
    "p": "blush", "P": "brick.hi",
    "M": "mouth",               # 입 선
    "A": "skin.ol",             # 벌린 입 테두리
    "O": "brick.shade",         # 입 안
    "T": "brick.hi",            # 혀
    "k": "skin.shade",          # 입꼬리·눈 아래 그늘
}

EYE_OPEN = """
..LLLLL.
LLLLLLLL
.dddddd.
.dGDDGd.
.GGDDGG.
.GGGGGG.
.GgggGG.
..GGGG..
"""
CATCH_OPEN = ((2, 2), (2, 3))

EXPR = {
    "neutral": dict(
        brow="""
            ..bbbbb.
            BBb.....
        """,
        eye=EYE_OPEN, catch=CATCH_OPEN,
        mouth="""
            k...k
            .MMM.
        """,
        blush="""
            pppp
        """,
    ),
    "happy": dict(
        brow="""
            ..bbbbb.
            BBb....B
        """, brow_dy=-2,
        eye="""
            ........
            ........
            ........
            ..LLLL..
            .LLLLLL.
            LL....LL
            L......L
            ........
        """,
        mouth="""
            AAAAAAA
            AOOOOOA
            .AOTOA.
            ..ATA..
            ...A...
        """, mouth_dy=-1,
        blush="""
            .pppp
            ppPPp
        """,
        fx=[("""
            ..y..
            ..y..
            yyYyy
            ..y..
            ..y..
        """, 2, 17), ("""
            .y.
            yYy
            .y.
        """, 5, 25)],
    ),
    "surprised": dict(
        brow="""
            ..bbbb..
            bBB...Bb
        """, brow_dy=-3,
        eye="""
            ..LLLL..
            .LLLLLLL
            Lwwddwww
            .wdGGdw.
            .wGDDGw.
            .wGGGGw.
            ..wggw..
            ...ww...
        """, eye_dy=-1, catch=((3, 3),),
        mouth="""
            .AA.
            AOOA
            AOOA
            .AA.
        """,
        blush="""
            pppp
        """,
        fx=[("""
            rr
            rr
            rr
            rr
            ..
            rr
        """, 6, 6)],
    ),
    "worried": dict(
        brow="""
            ......bb
            ...bbb..
            bbb.....
        """, brow_dy=-2,
        eye="""
            ........
            .....LL.
            LLLLLLLL
            .dddddd.
            .GGDDGG.
            .GGGGGG.
            .GgggGG.
            ..GGGG..
        """, catch=((2, 3), (2, 4)),
        mouth="""
            .MMM.
            M...M
        """, mouth_dy=1,
        blush="""
            .pp.
        """,
        fx=[("""
            ..t..
            .tct.
            tccct
            tWcct
            tWcTt
            .ttt.
        """, 50, 20)],
    ),
    "serious": dict(
        brow="""
            bbb.....
            .bbbbb..
            .....bbb
        """, brow_dy=0,
        eye="""
            ........
            ........
            ....LLLL
            LLLLLLLL
            .dddddd.
            .GGDDGG.
            .GgggGG.
            ..GGGG..
        """, catch=((2, 4),),
        mouth="""
            MMMM
        """, mouth_dy=1,
        blush=None,
    ),
}
FX = dict(FEAT, y="sparkle2", Y="sparkle", t="water.ol", c="water.hi", W="water.spec", T="water.base",
          r="cloth_red.base")


def _face(col, expr):
    e = EXPR[expr]
    blush = e.get("blush")
    if blush:
        w = len(_rows(blush)[0])
        _stamp(col, blush, BLUSH_X + (4 - w) // 2 + 1, BLUSH_Y, FEAT)
        _stamp(col, blush, 64 - BLUSH_X - w - (4 - w) // 2 - 1, BLUSH_Y, FEAT, flip=True)
    ew = len(_rows(e["eye"])[0])
    ey = EYE_Y + e.get("eye_dy", 0)
    for x0, flip in ((EYE_X, False), (64 - EYE_X - ew, True)):
        _stamp(col, e["eye"], x0, ey, FEAT, flip=flip)
        for cx, cy in e.get("catch", ()):
            col[ey + cy][x0 + cx] = "eye_shine"
    bw = len(_rows(e["brow"])[0])
    by = BROW_Y + e.get("brow_dy", 0)
    _stamp(col, e["brow"], BROW_X, by, FEAT)
    _stamp(col, e["brow"], 64 - BROW_X - bw, by, FEAT, flip=True)
    col[41][32] = "skin.shade"          # 코: 그늘 1픽셀
    mw = len(_rows(e["mouth"])[0])
    _stamp(col, e["mouth"], 32 - mw // 2, MOUTH_Y + e.get("mouth_dy", 0), FEAT)
    for text, x, y in e.get("fx", ()):
        _stamp(col, text, x, y, FX)


# ── 마무리 ───────────────────────────────────────────────────────────────────
def _base():
    g = _geometry()
    col = [[None] * W for _ in range(N)]
    _shade_hair(g, col)
    _shade_rest(g, col)
    _props(col)
    return col


BASE = _base()
_FLOATING = {c("sparkle"), c("sparkle2"), c("cloth_red.base")}


def portrait(expr):
    col = [r[:] for r in BASE]
    _face(col, expr)
    grid = ["".join(c(v) if v else "." for v in row) for row in col]
    # 떠 있는 효과(반짝임·느낌표)는 외곽선 없이 둔다. 머리핀·나침반의 빨강은 이미 다른 색에 둘러싸여 있다
    grid = auto_outline(grid, skip=_FLOATING)
    return [row[XO:XO + N] for row in grid]


EXPRS = ("neutral", "happy", "worried", "surprised", "serious")
PORTRAITS = {f"nuri_{k}": [portrait(k)] for k in EXPRS}
