"""지역 7 보스(32×32 프레임 4개): 모래 전갈(중간 보스)과 모래시계 스핑크스(최종 보스).

화풍 통일(docs/art-overhaul/style-guide.md §6.3, 기준 구현 forest_boss.py): 코지 팔레트만 쓰고 monsters.Px로 덩어리마다
3단 음영, auto_outline으로 1px 외곽선. 디자인은 옛 그림 그대로다.
- boss_sand_scorpion: 앞에서 본 거대한 붉은 사암빛 전갈(rust). 양옆으로 벌린 큰 집게, 몸 아래 다리 셋씩, 등에서 마디진
  꼬리가 오른쪽 위로 휘어 올라가 끝에 황동 테 모래시계(꼬리 독침 대신)가 달렸다. 지역 3·5의 게들(옆으로 낮은 몸)과
  달리 꼬리가 몸 위로 솟은 세로 실루엣이다.
- boss_hourglass_sphinx: 정면의 스핑크스. 황동·밤하늘 남색(cloth_indigo) 줄무늬 머릿수건, 모래빛 얼굴(sand), 엎드린 사자
  몸(한낮의 황금빛, rust를 한 단계 밝게)의 가슴에 시계 룬(지역 1~6 보스와 같은 황동 테·청록 문자판), 앞으로 뻗은 두 앞발, 크림 받침돌. 등 뒤 양옆으로
  떨어지다 공중에 멈춘 모래 폭포.

프레임(엔진은 맵·전투 모두 4프레임을 그대로 돌린다. 옛 [잠든, 깬]은 루프 안의 위협 프레임 3번으로 옮겼다, §6.3):
- 전갈: 0 노려봄(눈꺼풀 반쯤) → 1 숨(몸·집게 1px 들림) → 2 노려봄(꼬리 끝 모래시계의 모래알이 한 칸 떨어짐)
  → 3 위협(집게를 2px 치켜들어 활짝 벌리고 꼬리도 1px 듦, 눈이 청록으로 빛나고 모래시계 모래가 청록으로 빛남).
- 스핑크스: 0 졸음(눈꺼풀이 반쯤) → 1 숨(가슴·머리 1px 들림) → 2 졸음(시계 룬 바늘이 한 칸 돎)
  → 3 깨어남(눈을 크게 뜨고 청록으로 빛남, 문자판이 환해지고 멈춘 모래알이 반짝임).
"""
from cozypal import c
from monsters import Px, ellipse

SIZE = 32


def _e(cx, cy, rx, ry):
    return ellipse(cx, cy, rx, ry, SIZE)


def _line(p, pts, name, width=1):
    """꺾은선을 따라 점을 찍는다(width 2면 아래 칸도)."""
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0)) * 2 + 1
        for k in range(int(n) + 1):
            t = k / n
            x, y = round(x0 + (x1 - x0) * t), round(y0 + (y1 - y0) * t)
            for dy in range(width):
                p.put(x, y + dy, name)


# ── 모래 전갈 ───────────────────────────────────────────────────────────────
# 집게(왼쪽, 9×9): 손가락 둘이 위로. 'o'는 벌린 틈(위협 때 더 넓게)
_CLAW = (
    ".XX...X..",
    "XXX..XXX.",
    "XXX..XXX.",
    "XXXX.XXX.",
    ".XXXXXXX.",
    ".XXXXXX..",
    "..XXXXX..",
    "...XXX...",
)
_CLAW_OPEN = (
    "XX.....X.",
    "XXX...XXX",
    "XXX...XXX",
    ".XXX.XXX.",
    ".XXXXXXX.",
    ".XXXXXX..",
    "..XXXXX..",
    "...XXX...",
)


def _claw_cells(rows, ox, oy, flip):
    cells = set()
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch == "X":
                cells.add((ox + (len(r) - 1 - i if flip else i), oy + j))
    return cells


def _sand_scorpion(frame):
    p = Px(SIZE, SIZE)
    breathe = 1 if frame == 1 else 0
    threat = frame == 3
    lift = breathe + (2 if threat else 0)
    # 다리(몸 아래로 셋씩, 끝이 가늘고 마디에 밝은 점)
    for side in (1, -1):
        def X(v):
            return v if side == 1 else 31 - v
        for pts in (((11, 23), (6, 25), (4, 29)), ((12, 25), (8, 28), (7, 31)), ((13, 26), (11, 29), (11, 31))):
            _line(p, [(X(a), b) for a, b in pts], "leather.shade")
            p.put(X(pts[1][0]), pts[1][1], "leather.base")
    # 꼬리(등 뒤에서 오른쪽 위로 휘어 오르는 마디 다섯). 위협 때 1px 더 든다
    ty = 1 if threat else 0
    shell = set()
    for cx, cy, r in ((17.0, 15.2, 2.6), (19.4, 12.4, 2.4), (21.0, 9.6, 2.2), (21.8, 7.0, 2.0)):
        seg = _e(cx, cy - ty, r, r * 0.85)
        p.mass(seg, "rust")
        shell |= seg
    # 몸(머리가슴 + 배): 넓은 타원, 숨쉴 때 1px 들림
    body = _e(15.5, 21.5 - breathe, 8.0, 5.6)
    p.mass(body, "rust", shade_below=24)
    shell |= body
    # 등딱지·꼬리는 집게보다 한 단계 어둡게(짙은 붉은 갈색 껍데기, 밝은 집게가 앞으로 읽힌다)
    down = {"rust.spec": "rust.hi", "rust.hi": "rust.base", "rust.base": "rust.shade", "rust.shade": "rust.ol"}
    for x, y in shell:
        k = p.get(x, y)
        p.put(x, y, down.get(k, k))
    for y in (19, 22, 25):                                       # 등딱지 마디 홈
        for x in range(9, 23):
            if (x, y - breathe) in body and p.get(x, y - breathe) == "rust.shade":
                p.put(x, y - breathe, "rust.ol")
    p.put(11, 17 - breathe, "rust.hi")
    # 집게 팔(몸 옆에서 바깥 위로) + 집게
    for side in (1, -1):
        def X(v):
            return v if side == 1 else 31 - v
        _line(p, [(X(9), 20 - breathe), (X(6), 17 - lift), (X(5), 14 - lift)], "rust.shade", 2)
    rows = _CLAW_OPEN if threat else _CLAW
    for flip, ox in ((False, 0), (True, 23)):
        cells = _claw_cells(rows, ox, 7 - lift, flip)
        p.mass(cells, "rust")
        for x, y in cells:                                        # 집게 끝은 짙게
            if y <= 8 - lift and p.get(x, y) == "rust.base":
                p.put(x, y, "rust.shade")
    # 눈 둘(몸 앞쪽 위): 0~2는 눈꺼풀이 위를 덮고, 3은 청록으로 빛남
    ey = 18 - breathe
    for x in (12, 18):
        if threat:
            p.put(x, ey, "teal.spec")
            p.put(x + 1, ey, "teal.hi")
            p.put(x, ey + 1, "teal.hi")
            p.put(x + 1, ey + 1, "teal.base")
        else:
            p.put(x, ey, "rust.ol")
            p.put(x + 1, ey, "rust.ol")
            p.put(x, ey + 1, "lamp.hi")
            p.put(x + 1, ey + 1, "lamp.base")
    # 입 틈(위협 때 벌어짐)
    for x in range(14, 18):
        p.put(x, 23 - breathe, "rust.ol")
        if threat:
            p.put(x, 24, "void")
    # 꼬리 끝 모래시계(황동 위·아래 가로대, 기둥, 청록 유리 속 모래)
    gy = -ty
    for x in range(18, 25):
        p.put(x, gy + 0, "brass.hi")
        p.put(x, gy + 6, "brass.shade")
    for y in range(1, 6):
        p.put(18, gy + y, "brass.base")
        p.put(24, gy + y, "brass.shade")
    glass = {(20, 1), (21, 1), (22, 1), (20, 2), (21, 2), (22, 2), (21, 3), (20, 4), (21, 4), (22, 4),
             (20, 5), (21, 5), (22, 5)}
    for x, y in glass:
        p.put(x, gy + y, "teal.base" if x != 20 else "teal.hi")
    sand = "teal.spec" if threat else "sand.hi"
    for x, y in ((20, 1), (21, 1), (22, 1), (21, 2), (20, 5), (21, 5), (22, 5)):
        p.put(x, gy + y, sand)
    p.put(21, gy + (4 if frame == 2 else 3), sand)                 # 떨어지는 모래알
    for x, y in ((19, 1), (23, 1), (19, 5), (23, 5)):
        p.put(x, gy + y, "teal.shade")
    g = p.grid()
    if threat:                                                     # 모래시계 옆 반짝임
        g = [list(r) for r in g]
        if g[2][26] == ".":
            g[2][26] = c("sparkle")
        g = ["".join(r) for r in g]
    return g


# ── 모래시계 스핑크스 ────────────────────────────────────────────────────────
def _hourglass_sphinx(frame):
    p = Px(SIZE, SIZE)
    breathe = 1 if frame == 1 else 0
    awake = frame == 3
    # 받침돌(크림)
    plinth = {(x, y) for x in range(2, 30) for y in (30, 31)}
    p.mass(plinth, "cream")
    for x in range(2, 30):
        p.put(x, 30, "cream.hi" if x % 6 else "cream.shade")
    # 몸통(엎드린 사자, 정면): 넓은 어깨와 가슴. 숨쉴 때 1px 들림
    body = _e(15.5, 22.5 - breathe, 11.5, 7.0)
    body = {(x, y) for x, y in body if y <= 29}
    p.mass(body, "rust", shade_below=26, lift=1)
    # 앞발 둘(앞으로 뻗음)과 발가락
    for cx in (8.5, 22.5):
        paw = _e(cx, 27.6, 4.4, 2.5)
        p.mass(paw, "rust", lift=1)
        for dx in (-2, 0, 2):
            p.put(int(cx) + dx, 29, "rust.shade")
    # 머릿수건(네메스): 황동·남색 세로 줄무늬, 어깨로 퍼짐
    hy = -breathe
    head = _e(15.5, 8.5 + hy, 7.6, 7.0)
    for y in range(11 + hy, 19 + hy):
        w = 7.5 + (y - 11 - hy) * 0.6
        head |= {(x, y) for x in range(SIZE) if abs(x + 0.5 - 16) <= w}
    stripes = {(x, y) for x, y in head if (x // 2) % 2 == 0}
    p.mass(head - stripes, "cloth_indigo")
    p.mass(stripes, "brass")
    for x, y in head:                                             # 정수리 줄은 강조
        if y <= 2 + hy and (x, y) in stripes:
            p.put(x, y, "brass.hi")
    # 얼굴(밝은 모래빛): 아래로 갈수록 좁아지는 턱, 이마에 황동 코브라, 남색 눈화장
    face = set()
    for y in range(5 + hy, 15 + hy):
        inset = max(0, y - (11 + hy))
        face |= {(x, y) for x in range(12 + inset, 20 - inset)}
    p.mass(face, "sand", lift=1)
    for x in range(12, 20):                                       # 머릿수건 띠(이마)
        p.put(x, 5 + hy, "brass.base")
    p.put(15, 4 + hy, "brass.spec")
    p.put(16, 4 + hy, "brass.hi")
    p.put(15, 3 + hy, "brass.hi")
    ey = 9 + hy
    for x in (13, 17):
        p.put(x - (1 if x == 13 else 0), ey - 1, "cloth_indigo.shade")   # 눈화장(눈 위 선, 바깥으로 1px)
        p.put(x + (0 if x == 13 else 1), ey - 1, "cloth_indigo.shade")
        p.put(x + (1 if x == 13 else 0), ey - 1, "cloth_indigo.shade")
        if awake:                                                 # 깨어남: 눈을 크게 뜨고 청록으로 빛남
            p.put(x, ey, "teal.spec")
            p.put(x + 1, ey, "teal.hi")
            p.put(x, ey + 1, "teal.hi")
            p.put(x + 1, ey + 1, "teal.base")
        else:                                                     # 졸음: 눈꺼풀이 반쯤 덮은 가는 눈
            p.put(x, ey, "sand.shade")
            p.put(x + 1, ey, "sand.shade")
            p.put(x, ey + 1, "eye")
            p.put(x + 1, ey + 1, "eye")
    p.put(12, ey + 2, "blush")
    p.put(19, ey + 2, "blush")
    p.put(16, 10 + hy, "sand.shade")                              # 코 그늘
    p.put(16, 11 + hy, "sand.shade")
    for x in (15, 16):                                            # 입(깨어나면 벌어짐)
        p.put(x, 13 + hy, "sand.ol" if awake else "sand.shade")
    for y in range(15 + hy, 18 + hy):                             # 땋은 수염(황동·남색)
        p.put(15, y, "brass.base" if y % 2 else "cloth_indigo.shade")
        p.put(16, y, "brass.shade")
    # 가슴의 시계 룬(황동 테, 청록 문자판, 바늘)
    dx, dy = 12, 19 - breathe
    dial = (
        "..UUUU..",
        ".UffffU.",
        "UffffffU",
        "UffffffU",
        "UffffffU",
        "uffffffu",
        ".uffffu.",
        "..uuuu..",
    )
    face_col = "teal.hi" if awake else "teal.base"
    legend = {"U": "brass.hi", "u": "brass.shade", "f": face_col, "k": "ink"}
    for j, row in enumerate(dial):
        for i, ch in enumerate(row):
            if ch != ".":
                p.put(dx + i, dy + j, legend[ch])
    hands = ((3, 2), (3, 3), (4, 4), (5, 4)) if frame != 2 else ((3, 2), (3, 3), (4, 4), (4, 5))
    for i, j in hands:
        p.put(dx + i, dy + j, "ink")
    if awake:
        p.put(dx + 2, dy + 2, "teal.spec")
    g = p.grid()
    # 등 뒤 멈춘 모래 폭포(몸 뒤 투명 칸에만, 외곽선 없이): 줄기는 군데군데 끊기고 그 틈에 모래알이 떠 있다
    g = [list(r) for r in g]
    for x0, top, bottom in ((1, 0, 22), (3, 4, 18), (28, 4, 18), (30, 0, 22)):
        for y in range(top, bottom):
            k = y % 6
            if k == 0:
                continue
            col = "sand.hi" if k in (1, 2) else "sand.base" if k in (3, 4) else "rust.hi"
            if g[y][x0] == ".":
                g[y][x0] = c(col)
        for k, y in enumerate(range(bottom + 1, bottom + 7, 2)):  # 공중에 멈춘 모래알
            if g[y][x0] == ".":
                g[y][x0] = c("sparkle" if awake and k == 1 else "sand.spec")
    return ["".join(r) for r in g]


DESERT_BOSSES = {
    "boss_sand_scorpion": [_sand_scorpion(i) for i in range(4)],
    "boss_hourglass_sphinx": [_hourglass_sphinx(i) for i in range(4)],
}
