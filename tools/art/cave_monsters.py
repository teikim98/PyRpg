"""지역 3(고블린 동굴) 몬스터 5종(16×16 프레임 4개 제자리).

화풍 통일(docs/art-overhaul/style-guide.md §3·§6.2, 기준 구현 forest_monsters.py): 코지 팔레트(cozypal)의 이름 있는 색만
쓰고, monsters.Px로 덩어리마다 3단 음영(빛은 왼쪽 위)을 칠한 뒤 auto_outline(재질 ol)으로 바깥 외곽선을 두른다.
디자인(모양·정체)은 옛 그림 그대로다. 동굴 바닥(먼지빛 흙) 위에서 읽히게 몸 색을 바닥과 다른 색상으로 고른다.

| 몬스터 | 정체(문제) | 4프레임 |
|---|---|---|
| 번호표 고블린 | 막대 끝 번호표를 치켜든 꼬마 고블린(인덱싱, 음수 인덱스) | 다리 있는 몸: 서기 → 웅크림(1px) → 서기 → 깡충(1px 위). 번호표가 0 → 1 → 2 → −1 |
| 자르는 박쥐 | 날개 끝이 칼로 자른 듯 곧은 사선, 쇠빛 날(슬라이싱) | 나는 몸 0 → −1 → −2 → −1px, 날개 펼침 → 듦 → 내림 → 듦 |
| 쌓는 게 | 등에 상자를 층층이(위 1, 아래 2) 얹은 빨간 게(append·pop) | 다리 두 벌 번갈아 + 디딜 때 1px, 맨 위 상자가 반 박자 늦게 따라오고 4번째에 집게를 듦 |
| 거울 슬라임 | 몸 윗면이 웅덩이처럼 동굴 천장(종유석)을 비춤(컴프리헨션 = 비춰 만든 새 리스트) | 통통 튀는 몸: 기본 → 눌림 → 기본 → 늘어남, 바닥 줄 고정 |
| 격자 골렘 | 몸이 3×3 격자로 나뉜 돌덩이(2차원 리스트) | 걸음마다 1px, 빛나는 칸이 가운데 열을 위에서 아래로 한 칸씩(열 순회), 4번째에 눈이 빛나고 팔을 듦 |
"""
from forest_monsters import _body
from monsters import FLY, Px, ellipse

# ── 번호표 고블린 ────────────────────────────────────────────────────────────────
SKIN = "leaf"      # 고블린 피부(올리브 초록, lift=1로 한 단계 밝게). 보스·서기와 같은 램프

_GOB_HEAD = """
...xxxxxx...
..xxxxxxxx..
x.xxxxxxxx.x
xxxxxxxxxxxx
.xxxxxxxxxx.
..xxxxxxxx..
...xxxxxx...
"""
_GLYPHS = {
    "0": ("kkk", "k.k", "k.k", "kkk"),
    "1": (".k.", "kk.", ".k.", "kkk"),
    "2": ("kk.", "..k", ".k.", "kkk"),
    "-1": ("...k.", "..kk.", "kk.k.", "..kkk"),
}


def _goblin(dy, digit):
    p = Px()
    # 다리(가죽 바지·맨발): 발은 15행에 고정, 웅크리면 다리가 짧아지고 깡충 뛰면 길어진다
    for x in (4, 7):
        for y in range(12 + dy, 16):
            p.put(x, y, "leather.base" if y < 15 else f"{SKIN}.base")
            p.put(x + 1, y, "leather.shade" if y < 15 else f"{SKIN}.shade")
    # 몸(가죽 조끼)
    body = ellipse(6.0, 11.6 + dy, 3.2, 2.2)
    p.mass(body, "leather", shade_below=12 + dy)
    p.put(6, 10 + dy, "brass.hi")                          # 조끼 단추
    # 머리 + 옆으로 뻗은 뾰족한 귀
    lines = [ln.strip() for ln in _GOB_HEAD.strip("\n").splitlines()]
    oy = 2 + dy
    head = {(i, oy + j) for j, ln in enumerate(lines) for i, ch in enumerate(ln) if ch == "x"}
    p.mass(head, SKIN, lift=1)
    for ex in (4, 7):                                       # 점 눈 1×2
        p.put(ex, oy + 3, "eye")
        p.put(ex, oy + 4, "eye")
    p.put(3, oy + 5, "blush")
    p.put(8, oy + 5, "blush")
    for x in (5, 6):                                        # 씩 웃는 입과 이빨 하나
        p.put(x, oy + 5, f"{SKIN}.ol")
    p.put(6, oy + 6, "white")
    # 오른팔과 막대, 번호표(크림색 종이에 잉크 숫자)
    p.put(9, 10 + dy, f"{SKIN}.hi")
    p.put(10, 9 + dy, f"{SKIN}.hi")
    p.put(11, 9 + dy, f"{SKIN}.base")                      # 주먹
    for y in range(5 + dy, 9 + dy):
        p.put(12, y, "wood.base")
    glyph = _GLYPHS[digit]
    w = 5
    tx, ty = 11, 0 + dy
    for j in range(5):
        for i in range(w):
            p.put(tx + i, ty + j, "cream.spec" if j < 4 else "cream.shade")
    gx = tx + (w - len(glyph[0])) // 2
    for j, row in enumerate(glyph):
        for i, ch in enumerate(row):
            if ch == "k":
                p.put(gx + i, ty + j, "ink")
    return p.grid()


# ── 자르는 박쥐: 칼로 자른 듯 곧은 사선 날개, 앞 가장자리는 쇠빛 날 ──────────────────────
# b 몸, r 귀, E 눈, f 송곳니, w 날개 막, e 날(앞 가장자리). 좌우 대칭으로 쓴다
_BAT_BODY = """
.....r....r.....
.....rbbbbr.....
.....bEbbEb.....
.....bbbbbb.....
.....bbffbb.....
......bbbb......
.......bb.......
"""
_BAT_WINGS = {
    "spread": """
e..............e
we............ew
wwe..........eww
wwwe........ewww
.wwwe......ewww.
...wwe....eww...
""",
    "up": """
.e............e.
.we..........ew.
.wwe........eww.
..wwe......eww..
...wwe....eww...
....ww....ww....
""",
    "down": """
................
................
.....e....e.....
...eww....wwe...
.ewwww....wwwwe.
ewww........wwwe
""",
}


def _bat(pose, dy):
    p = Px()
    wy = {"spread": 3, "up": 1, "down": 4}[pose] + dy
    wings = [ln.strip() for ln in _BAT_WINGS[pose].strip("\n").splitlines()]
    membrane = {(i, wy + j) for j, ln in enumerate(wings) for i, ch in enumerate(ln) if ch == "w"}
    p.mass(membrane, "denim")
    for j, ln in enumerate(wings):                          # 쇠빛 날: 왼쪽 날개는 빛을 받아 밝고 오른쪽은 기본
        for i, ch in enumerate(ln):
            if ch == "e":
                p.put(i, wy + j, "stone.hi" if i < 8 else "stone.base")
    tip = {"spread": (0, 0), "up": (1, 0), "down": (0, 5)}[pose]
    p.put(tip[0], wy + tip[1], "stone.spec")
    oy = 3 + dy
    body = [ln.strip() for ln in _BAT_BODY.strip("\n").splitlines()]
    cells = {(i, oy + j) for j, ln in enumerate(body) for i, ch in enumerate(ln) if ch != "."}
    p.mass(cells, "denim", lift=1)
    for j, ln in enumerate(body):
        for i, ch in enumerate(ln):
            if ch == "E":
                p.put(i, oy + j, "teal.spec")
            elif ch == "f":
                p.put(i, oy + j, "white")
            elif ch == "r":
                p.put(i, oy + j, "denim.base" if i < 8 else "denim.shade")
    p.put(7, oy + 4, "denim.ol")                            # 입 가운데
    return p.grid()


# ── 쌓는 게: 등에 나무 상자를 층층이(아래 2, 위 1) 얹은 빨간 게 ─────────────────────────
_LEGS_A = ((1, 13), (2, 14), (3, 15))
_LEGS_B = ((1, 14), (2, 15), (4, 15))


def _crate(p, x0, y0, w, h):
    cells = {(x, y) for x in range(x0, x0 + w) for y in range(y0, y0 + h)}
    p.mass(cells, "wood")
    for x in range(x0 + 1, x0 + w - 1):                     # 판자 이음새
        p.put(x, y0 + h // 2, "wood.shade")
    p.put(x0, y0, "brass.hi")                               # 황동 모서리
    p.put(x0 + w - 1, y0, "brass.base")


def _crab(frame):
    p = Px()
    bob = (0, 1, 0, 1)[frame]
    lag = (0, 0, 1, 1)[frame]                               # 맨 위 상자는 반 박자 늦게 따라온다
    legs = _LEGS_A if frame % 2 == 0 else _LEGS_B
    for x, y in legs:                                       # 다리(양쪽, 오른쪽은 반대 박자)
        p.put(x + 1, y - 1, "cloth_red.shade")
        p.put(x, y, "cloth_red.shade")
    for x, y in (_LEGS_B if frame % 2 == 0 else _LEGS_A):
        p.put(14 - x, y - 1, "cloth_red.shade")
        p.put(15 - x, y, "cloth_red.shade")
    body = ellipse(8, 11.8 + bob, 4.8, 2.6)
    p.mass(body, "cloth_red", shade_below=13 + bob)
    raise_claw = frame == 3
    for cx in (1.9, 14.1):                                  # 집게(4번째 프레임에 치켜듦)
        cy = (6.6 if raise_claw else 9.4) + bob
        claw = ellipse(cx, cy, 1.9, 2.0)
        p.mass(claw, "cloth_red", lift=1)
        p.put(round(cx - 0.5), round(cy - 2.0), "cloth_red.ol")   # 집게 틈
        arm_x = 3 if cx < 8 else 12
        p.put(arm_x, round(cy) + 1, "cloth_red.base")          # 집게 팔
    for ex in (6, 9):                                       # 눈(짧은 눈자루 위)
        p.put(ex, 10 + bob, "eye")
        p.put(ex, 9 + bob, "white")
    p.put(5, 12 + bob, "blush")
    p.put(10, 12 + bob, "blush")
    _crate(p, 3, 5 + bob, 5, 4)                             # 아래 상자 둘
    _crate(p, 8, 5 + bob, 5, 4)
    _crate(p, 5, 1 + lag, 6, 4)                             # 위 상자
    return p.grid()


# ── 거울 슬라임: 윗면이 웅덩이처럼 천장을 비추는 물빛 슬라임 ────────────────────────────
def _mirror_slime(w, h):
    p = Px()
    body, top = _body(w, h)
    p.mass(body, "water", shade_below=13, lift=1)
    # 비치는 윗면: 수면 선(강조) 아래로 짙은 물빛 띠, 거꾸로 선 종유석 두 개
    inner = {(x, y) for x, y in body if (x - 1, y) in body and (x + 1, y) in body}
    for x, y in inner:
        if y == top + 1:
            p.put(x, y, "water.spec")
        elif top + 2 <= y <= top + 3:
            p.put(x, y, "water.shade")
    for x0 in (5, 9):
        for x, y in ((x0, top + 2), (x0 + 1, top + 2), (x0, top + 3)):
            if (x, y) in inner:
                p.put(x, y, "stone.shade")
    p.put(min(x for x, y in inner if y == top + 2), top + 2, "white")     # 비친 빛 한 점
    ey = top + 4 + (1 if h >= 9 else 0)
    for ex in (5, 10):
        p.put(ex, ey, "eye")
        p.put(ex, ey + 1, "eye")
    p.put(4, ey + 2, "blush")
    p.put(11, ey + 2, "blush")
    p.put(7, ey + 2, "water.shade")
    p.put(8, ey + 2, "water.shade")
    return p.grid()


# ── 격자 골렘: 몸이 3×3 격자로 나뉜 돌덩이, 청록 눈 ──────────────────────────────────
_COLS = ((3, 4, 5), (7, 8), (10, 11, 12))
_ROWS = ((6, 7), (9, 10), (12, 13))


def _golem(frame):
    p = Px()
    bob = (0, 1, 0, 1)[frame]
    threat = frame == 3
    for x in (4, 5, 10, 11):                                # 다리(15행 고정)
        for y in range(14 + bob, 16):
            p.put(x, y, "stone.base" if x in (4, 10) else "stone.shade")
    body = {(x, y + bob) for x in range(3, 13) for y in range(6, 14)}
    p.mass(body, "stone", lift=1)
    for y in range(6, 14):                                  # 격자 줄(세로)
        for x in (6, 9):
            p.put(x, y + bob, "stone.shade")
    for x in range(3, 13):                                  # 격자 줄(가로)
        for y in (8, 11):
            p.put(x, y + bob, "stone.shade")
    if not threat:                                          # 빛나는 칸: 가운데 열을 위에서 아래로
        for y in _ROWS[frame]:
            for x in _COLS[1]:
                p.put(x, y + bob, "teal.hi")
        p.put(7, _ROWS[frame][0] + bob, "teal.spec")
    head = {(x, y + bob) for x in range(5, 11) for y in range(1, 6)}
    p.mass(head, "stone", lift=1)
    for ex in (6, 9):
        p.put(ex, 3 + bob, "teal.spec" if threat else "teal.hi")
        if threat:
            p.put(ex, 2 + bob, "teal.hi")
    p.put(7, 4 + bob, "stone.shade")
    p.put(8, 4 + bob, "stone.shade")
    arm_y = 4 if threat else 7                              # 팔(4번째 프레임에 치켜듦)
    for x0 in (1, 13):
        arm = {(x, y + bob) for x in (x0, x0 + 1) for y in range(arm_y, arm_y + 4)}
        p.mass(arm, "stone")
    return p.grid()


CAVE_MONSTERS = {
    "monster_index_goblin": [_goblin(0, "0"), _goblin(1, "1"), _goblin(0, "2"), _goblin(-1, "-1")],
    "monster_slice_bat": [_bat(pose, dy) for pose, dy in zip(("spread", "up", "down", "up"), FLY)],
    "monster_stack_crab": [_crab(i) for i in range(4)],
    # 통통 튀는 몸: 기본(폭 12·높이 9) → 눌림(14·8) → 기본 → 늘어남(10·10)
    "monster_mirror_slime": [_mirror_slime(12, 9), _mirror_slime(14, 8), _mirror_slime(12, 9),
                             _mirror_slime(10, 10)],
    "monster_grid_golem": [_golem(i) for i in range(4)],
}
