"""지역 6 보스(32×32 프레임 4개): 거울 쌍둥이(중간 보스)와 호수의 메아리(최종 보스).

화풍 통일(docs/art-overhaul/style-guide.md §6.3, 기준 구현 forest_boss.py): 코지 팔레트만 쓰고 monsters.Px로 덩어리마다
3단 음영, auto_outline으로 1px 외곽선. 디자인은 옛 그림 그대로다.
- boss_mirror_twins: 왼쪽은 물빛(water), 오른쪽은 은빛 거울빛(sky)인 쌍둥이 물의 정령이 좌우가 뒤집힌 채 마주 서서
  가운데 세로 거울 금에 손바닥을 맞댔다. 머리카락은 바깥으로 흘러내리는 물줄기, 이마에 황동 띠, 아래는 소용돌이 물결.
  왼쪽 절반만 그리고 좌우를 뒤집는다. 지역 3 거울 슬라임(낮은 돔)과 달리 키 큰 사람 모양 둘이다.
- boss_lake_echo: 겹겹의 동심원 물결로 된 둥근 메아리 정령(바깥 연보라 → 하늘빛 → 물빛). 가운데에 시계 룬(황동 테,
  청록 문자판), 그 위로 두 눈. 몸 아래로 물결이 왼쪽은 둘, 오른쪽은 셋으로 갈라져 작은 메아리 고리가 된다
  (E(n//2) + E(n//3)).

프레임(엔진은 맵·전투 모두 4프레임을 그대로 돌리고 잠든/깬 상태를 고르지 않으므로, 옛 [잠든, 깬] 2프레임을 루프 안의
위협 프레임으로 옮겼다): 0 노려봄(눈꺼풀이 반쯤 덮임) → 1 숨(윗몸·고리 1px) → 2 노려봄(거울 금의 빛·시계 바늘이 움직임)
→ 3 위협(눈을 크게 뜨고 빛남, 거울 금 / 고리와 메아리가 환하게 퍼짐, 반짝임).
"""
import math

from cozypal import c
from monsters import Px

SIZE = 32

# ── 거울 쌍둥이 ──────────────────────────────────────────────────────────────
# 왼쪽 절반(16칸). b 몸(머리카락·몸·소용돌이), F 얼굴·손, G 이마 띠, e 눈, m 입, W 소용돌이 물보라
_TWIN_HALF = [
    "................",
    "................",
    "...........bbb..",
    ".........bbbbbb.",
    ".......bbbbbbbbb",
    "......bbbbbbbbbb",
    ".....bbbbbGGGGbb",
    "....bbbbFFFFFFbb",
    "....bbbFFFFFFFbb",
    "...bbbbFFFFeFFbb",
    "...bbb.FFFFeFF..",
    "..bbbb..FFFFmF..",
    "..bbb....FFFF...",
    ".bbbb....bFFb...",
    ".bbb...bbbbbbb..",
    ".bbb..bbbbbbbbb.",
    ".bb..bbbbbbbbbbF",
    ".bb.bbbbbbbbFFFF",
    ".b..bbbbbbbbbbFF",
    "....bbbbbbbbbbb.",
    "....bbbbbbbbbb..",
    "...bbbbbbbbbbb..",
    "...bbbbbbbbbbbb.",
    "..bbbbbbbbbbbbb.",
    "..bbbbbbbbbbbbbb",
    ".bbbbbbbbbbbbbbb",
    ".bbbbbbbbbbbbb..",
    "..bbbbbbbbbbbb..",
    "...bbbbbbbbbb...",
    "..bW...bbW......",
    ".bW....bW..bW...",
    "................",
]
_SWIRL = ((6, 22), (7, 23), (8, 24), (9, 24), (5, 25), (10, 23))   # 몸통 소용돌이 무늬(왼쪽 기준)


def _twin_cells(ch_set, frame):
    """_TWIN_HALF에서 ch_set 문자의 칸(왼쪽, 오른쪽 거울). 숨 프레임(1)은 14행 위(머리)가 1px 올라가고,
    13행은 제자리에도 남겨 목이 1px 늘어난다(틈이 생기지 않게)."""
    lift = 1 if frame == 1 else 0
    left = set()
    for y, row in enumerate(_TWIN_HALF):
        for x, ch in enumerate(row):
            if ch in ch_set:
                left.add((x, y - (lift if y < 14 else 0)))
                if lift and y == 13:
                    left.add((x, y))
    return left, {(SIZE - 1 - x, y) for x, y in left}


def _mirror_twins(frame):
    p = Px(SIZE, SIZE)
    threat = frame == 3
    body_l, body_r = _twin_cells("bFGemW", frame)
    face_l, face_r = _twin_cells("Fem", frame)
    # 머리카락·몸은 물빛(water) / 거울빛(sky), 얼굴·손은 한 단계 밝은 재질(하늘빛 / 은백)이라 머리카락과 갈린다
    for body, face, ramp, face_ramp in ((body_l, face_l, "water", "sky"), (body_r, face_r, "sky", "cloth_white")):
        p.mass(body, ramp)
        p.mass(face, face_ramp, lift=1 if face_ramp == "sky" else 0)
    band_l, band_r = _twin_cells("G", frame)
    for x, y in band_l | band_r:                          # 이마 황동 띠
        p.put(x, y, "brass.hi" if (x + y) % 3 else "brass.base")
    for sx, sy in _SWIRL:                                 # 몸통 소용돌이(밝은 물줄기)
        p.put(sx, sy, "water.hi")
        p.put(SIZE - 1 - sx, sy, "sky.spec")
    eye_l, eye_r = _twin_cells("e", frame)
    for cells, ramp in ((eye_l, "sky"), (eye_r, "cloth_white")):
        top = min(y for _, y in cells)
        for x, y in cells:
            if threat:
                p.put(x, y, "teal.spec" if y == top else "teal.hi")
            else:
                p.put(x, y, f"{ramp}.shade" if y == top else "eye")   # 반쯤 감은 눈꺼풀
    mouth_l, mouth_r = _twin_cells("m", frame)
    for x, y in mouth_l | mouth_r:
        p.put(x, y, "water.ol" if x < 16 else "sky.ol")
    foam_l, foam_r = _twin_cells("W", frame)
    for x, y in foam_l | foam_r:
        p.put(x, y, "white")
    g = [list(r) for r in p.grid(skip=("white",))]

    # 가운데 세로 거울 금: 흰 심이 지그재그로 내려가고(15·16열), 손바닥이 닿은 곳은 빛난다.
    # 노려봄 프레임은 금의 빛 한 점이 위아래로 움직이고, 위협 프레임은 금 전체가 환하다
    glint = {0: 6, 1: 12, 2: 24, 3: -1}[frame]
    for y in range(1, 31):
        x = 15 if (y // 3) % 2 == 0 else 16
        if 15 <= y <= 18:
            g[y][15] = g[y][16] = c("white")
            continue
        if threat or abs(y - glint) <= 1:
            g[y][x] = c("white")
        else:
            g[y][x] = c("sky.spec") if g[y][x] == "." or y % 2 else c("sky.hi")
    if threat:
        for x, y in ((12, 15), (19, 15), (11, 21), (20, 21), (15, 0), (16, 31)):
            if g[y][x] == ".":
                g[y][x] = c("sparkle")
        for x, y in ((13, 15), (18, 15), (12, 21), (19, 21)):
            if g[y][x] == ".":
                g[y][x] = c("sparkle2")
    return ["".join(r) for r in g]


# ── 호수의 메아리 ────────────────────────────────────────────────────────────
CX, CY = 16.0, 14.0
_DOWN = {"hi": "base", "base": "shade", "shade": "ol", "spec": "hi"}


def _ring(d, pulse):
    """중심에서의 거리 → 몸 색(고리마다 밝은 띠, 사이는 그 램프의 기본)."""
    if abs(d - (12.0 + pulse)) < 0.8:
        return "cloth_purple.hi"
    if d > 9.6 + pulse * 0.7:
        return "cloth_purple.base"
    if abs(d - (9.0 + pulse * 0.7)) < 0.75:
        return "sky.hi"
    if d > 6.9 + pulse * 0.4:
        return "sky.base"
    if abs(d - (6.3 + pulse * 0.4)) < 0.75:
        return "water.hi"
    return "water.base"


def _lake_echo(frame):
    threat = frame == 3
    pulse = (0.0, 0.5, 0.0, 0.9)[frame]
    p = Px(SIZE, SIZE)
    radius = 12.8 + pulse
    for y in range(SIZE):
        for x in range(SIZE):
            dx, dy = x + 0.5 - CX, y + 0.5 - CY
            d = math.hypot(dx, dy)
            if d <= radius:
                col = _ring(d, pulse)
                if dx + dy > 7:                           # 빛은 왼쪽 위: 오른쪽 아래는 한 단계 그늘
                    r, s = col.split(".")
                    col = f"{r}.{_DOWN[s]}"
                p.put(x, y, col)
    # 갈라지는 메아리: 왼쪽 아래 고리 둘, 오른쪽 아래 고리 셋(작은 동심원). 위협 때 한 칸 퍼지고 밝다
    echoes = ((6.5, 27.0, 2.4), (2.5, 29.8, 1.5), (23.0, 27.0, 2.0), (28.0, 29.0, 1.4), (29.8, 24.6, 1.2))
    grow = 0.4 if threat else (0.2 if frame == 1 else 0.0)
    for ex, ey, r in echoes:
        r += grow
        for y in range(SIZE):
            for x in range(SIZE):
                if p.get(x, y):
                    continue
                d = math.hypot(x + 0.5 - ex, y + 0.5 - ey)
                if abs(d - r) < 0.6:
                    p.put(x, y, ("cloth_purple.spec" if threat else "cloth_purple.hi") if y + 0.5 < ey
                          else "sky.base")
                elif d < r - 0.6:
                    p.put(x, y, "cloth_purple.shade")
    for x, y in ((10, 25), (9, 26), (8, 26), (21, 25), (22, 26), (26, 26), (27, 25)):
        if not p.get(x, y):                               # 몸에서 메아리로 이어지는 물줄기(둘·셋으로 갈라짐)
            p.put(x, y, "sky.base")
    # 두 눈: 노려봄은 위쪽을 눈꺼풀(고리 색)이 덮고, 위협은 크게 뜨고 청록으로 빛난다
    for ex in (10, 20):
        if threat:
            for dx in (0, 1):
                p.put(ex + dx, 6, "teal.hi")
                p.put(ex + dx, 7, "teal.base")
                p.put(ex + dx, 8, "teal.base")
            p.put(ex, 6, "white")
        else:
            p.put(ex, 7, "sky.shade")
            p.put(ex + 1, 7, "sky.shade")
            p.put(ex, 8, "eye")
            p.put(ex + 1, 8, "eye")
    # 가운데 시계 룬(황동 테, 청록 문자판, 바늘). 노려봄 2는 바늘이 한 칸 돎, 위협은 문자판이 환하다
    face = "teal.hi" if threat else "teal.base"
    dial = [
        "..UUUU..",
        ".UffffU.",
        "UfffkffU",
        "UfffkffU",
        "Ufffkkfu",
        "Uffffffu",
        ".uffffu.",
        "..uuuu..",
    ] if frame != 2 else [
        "..UUUU..",
        ".UffffU.",
        "UffffffU",
        "UfffkffU",
        "UfffkkkU",
        "Uffffffu",
        ".uffffu.",
        "..uuuu..",
    ]
    legend = {"U": "brass.hi", "u": "brass.shade", "f": face, "k": "ink"}
    for j, row in enumerate(dial):
        for i, ch in enumerate(row):
            if ch != ".":
                p.put(12 + i, 11 + j, legend[ch])
    if threat:
        p.put(13, 12, "white")
    g = p.grid(skip=("sparkle",))
    if threat:                                            # 메아리 고리 위 반짝임
        g = [list(r) for r in g]
        for x, y in ((5, 23), (29, 20)):
            if g[y][x] == ".":
                g[y][x] = c("sparkle")
        g = ["".join(r) for r in g]
    return g


LAKE_BOSSES = {
    "boss_mirror_twins": [_mirror_twins(i) for i in range(4)],
    "boss_lake_echo": [_lake_echo(i) for i in range(4)],
}
