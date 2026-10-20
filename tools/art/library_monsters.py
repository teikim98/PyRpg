"""지역 4(무너진 대도서관) 몬스터 5종(16×16 프레임 4개 제자리).

화풍 통일(docs/art-overhaul/style-guide.md §3·§6.2, 기준 구현 forest_monsters.py): 코지 팔레트(cozypal)의 이름 있는 색만
쓰고, monsters.Px로 덩어리마다 3단 음영(빛은 왼쪽 위)을 칠한 뒤 auto_outline(재질 ol)으로 바깥 외곽선을 두른다.
지역 강조색 cloth_indigo(잉크) · cream(양피지) · brick(봉랍)을 몸에 나눠 쓰고, 옛 디자인(모양·정체)은 그대로 둔다.
지역 1~3 몬스터와 실루엣이 겹치지 않게: 나방은 넓은 두 겹 날개, 잉크 슬라임은 머리에 인 잉크병, 깃펜 정령은 비스듬한
깃털 한 자루, 두루마리 뱀은 말린 통 + 물결치는 종이 띠(지역 2 고리 뱀처럼 닫힌 고리가 아님), 암호 부엉이는 귀깃 대신
납작한 학사모와 술, 책 위에 앉은 넓은 몸(지역 2 달력 부엉이처럼 뛰지 않음).

| 몬스터 | 정체(문제) | 4프레임 |
|---|---|---|
| 글자 나방 | 양피지 날개에 잉크 글자 A·Z | 나는 몸 0 → −1 → −2 → −1px, 날개는 1·3번에서 위로 접힘 |
| 잉크 슬라임 | 머리에 쓰러진 잉크병을 인 잉크 웅덩이 | 통통 튀는 몸: 기본 → 눌림 → 기본 → 늘어남, 바닥 줄 고정, 병도 함께 오르내림 |
| 깃펜 정령 | 비스듬한 깃털 펜, 펜촉의 잉크 방울 | 나는 몸 0 → −1 → −2 → −1px, 깃 끝이 흔들리고 잉크 방울이 맺혔다 떨어짐 |
| 두루마리 뱀 | 말린 두루마리 통에서 풀린 종이 띠 | 물결이 프레임마다 1/4 주기씩 흘러가고 통의 감긴 표시가 1/4씩 돎, 머리가 물결 따라 오르내림 |
| 암호 부엉이 | 바퀴 눈, 가슴의 글자가 A → B → C → D(알파벳 밀기) | 바퀴 눈의 바늘이 1/4씩 돌고 글자가 한 칸씩 밀림, 학사모 술이 흔들림 |
"""
import math

from cozypal import c
from forest_monsters import _body
from monsters import FLY, Px, ellipse


def _eyes(p, y, xs=(5, 10)):
    for x in xs:
        p.put(x, y, "eye")
        p.put(x, y + 1, "eye")


# ── 글자 나방: 양피지 날개 두 겹, 앞날개에 잉크 글자(A와 Z), 털 많은 가죽빛 몸, 깃털 더듬이 ───────────────
_GLYPH = {
    "A": (".W.", "W.W", "WWW", "W.W"),
    "Z": ("WWW", "..W", ".W.", "WWW"),
}


def _glyph(p, ch, x, y, color):
    for j, row in enumerate(_GLYPH[ch]):
        for i, v in enumerate(row):
            if v == "W":
                p.put(x + i, y + j, color)


def _moth(frame, dy):
    p = Px()
    folded = frame % 2 == 1
    o = dy
    if folded:            # 날개를 위로 접어 올림: 좁고 높은 앞날개, 작은 뒷날개
        fore = ellipse(4.4, 4.2 + o, 2.6, 3.4) | ellipse(11.6, 4.2 + o, 2.6, 3.4)
        hind = ellipse(5.4, 9.0 + o, 1.8, 1.8) | ellipse(10.6, 9.0 + o, 1.8, 1.8)
        gy, gl, gr = 3 + o, 3, 11
    else:                 # 활짝 편 날개: 넓은 앞날개, 아래 둥근 뒷날개
        fore = ellipse(3.6, 6.4 + o, 3.5, 3.0) | ellipse(12.4, 6.4 + o, 3.5, 3.0)
        hind = ellipse(4.8, 10.6 + o, 2.6, 2.0) | ellipse(11.2, 10.6 + o, 2.6, 2.0)
        gy, gl, gr = 5 + o, 2, 11
    p.mass(hind, "cream")
    for x, y in hind:                                    # 뒷날개는 한 단계 어둡게 + 봉랍 빨강 눈무늬
        p.put(x, y, {"cream.hi": "cream.base", "cream.base": "cream.shade", "cream.shade": "cream.shade"}[p.get(x, y)])
    for cx in (4, 11):
        cy = (9 if folded else 10) + o
        p.put(cx, cy, "brick.base")
    p.mass(fore, "cream")
    _glyph(p, "A", gl, gy, "cloth_indigo.shade")
    _glyph(p, "Z", gr, gy, "cloth_indigo.shade")
    # 몸: 털 많은 가슴(밝은 크림 깃) + 마디진 배(가죽빛)
    abdomen = ellipse(8, 10.2 + o, 1.6, 3.0)
    p.mass(abdomen, "leather")
    for x, y in abdomen:
        if (y - o) % 2 == 0 and p.get(x, y) == "leather.base":
            p.put(x, y, "leather.shade")
    head = ellipse(8, 5.6 + o, 2.0, 1.9)
    p.mass(head, "leather", lift=1)
    for x in (7, 8):
        p.put(x, 7 + o, "cream.hi")                      # 털 목깃
    _eyes(p, 5 + o, (6, 9))
    # 깃털 더듬이
    for x, y in ((7, 3), (6, 2), (5, 1), (8, 3), (9, 2), (10, 1)):
        p.put(x, y + o, "leather.base")
    for x, y in ((4, 1), (6, 1), (11, 1), (9, 1)):
        p.put(x, y + o, "leather.shade")
    return p.grid()


# ── 잉크 슬라임: 머리에 쓰러진 잉크병(유리·코르크·양피지 상표), 병 주둥이에서 흘러나온 잉크 몸 ────────────────
def _ink(w, h, drip):
    p = Px()
    body, top = _body(w, h)
    p.mass(body, "cloth_indigo", shade_below=13)
    lx = min(x for x, y in body if y == top + 2) + 1
    p.put(lx, top + 2, "white")                          # 잉크 광택
    p.put(lx, top + 3, "cloth_indigo.spec")
    ey = top + max(2, (h * 45) // 100)
    _eyes(p, ey, (6, 10))
    p.put(5, ey + 2, "blush")
    p.put(11, ey + 2, "blush")
    # 머리 위에 옆으로 쓰러진 잉크병(왼쪽이 병 바닥, 오른쪽이 코르크 주둥이). 몸 위에 1px 파묻힌다
    # 병 몸통(2~6열, 3줄) → 좁은 목(7열) → 코르크(8~9열). 머리 왼쪽으로 치우쳐 누워서 모자가 아니라 병으로 읽힌다
    by = top - 2
    bottle = {(x, y) for x in range(2, 7) for y in range(by, by + 3)} - {(2, by)}
    p.mass(bottle, "sky")
    for x in range(3, 7):                                # 병 속에 남은 잉크(아래 줄)
        p.put(x, by + 2, "cloth_indigo.shade")
    for x in (4, 5):                                     # 양피지 상표
        p.put(x, by + 1, "cream.hi")
    p.put(3, by, "sky.spec")
    p.put(7, by + 1, "sky.base")                         # 병목
    p.put(7, by + 2, "sky.shade")
    p.put(8, by + 1, "wood.hi")                          # 코르크
    p.put(9, by + 1, "wood.shade")
    p.put(9, by + 2, "cloth_indigo.base")                # 주둥이에서 흘러내린 잉크
    if drip:
        p.put(13, top + 1, "cloth_indigo.base")          # 늘어날 때 옆으로 튄 잉크 방울
    return p.grid()


# ── 깃펜 정령: 비스듬히 선 깃털 펜(아래 황동 펜촉, 위 청록 서리 낀 깃 끝), 깃 가운데 작은 얼굴 ─────────────────
def _quill(frame, dy):
    p = Px()
    o = dy
    sway = (0, 1, 0, -1)[frame]
    # 깃: (3,13) → (13,1) 축을 따라 긴 타원. 깃 끝(위쪽 3행)은 프레임마다 좌우로 1px 흔들린다
    ax, ay = 1 / math.sqrt(2), -1 / math.sqrt(2)
    cx, cy = 9.0, 6.0 + o
    vane = set()
    for y in range(16):
        for x in range(16):
            u = (x + 0.5 - cx) * ax + (y + 0.5 - cy) * ay
            v = (x + 0.5 - cx) * -ay + (y + 0.5 - cy) * ax
            if (u / 6.2) ** 2 + (v / 2.7) ** 2 <= 1.0:
                vane.add((x + (sway if y < 3 + o else 0), y))
    p.mass(vane, "cream", lift=1)
    for k in range(-5, 6):                               # 깃대(가운데 줄)
        x, y = round(cx + ax * k - 0.5), round(cy + ay * k - 0.5)
        if (x, y) in vane and k > -3:
            p.put(x, y, "cream.shade")
    for x, y in ((5, 10), (4, 11)):                      # 깃 밑동 → 깃대
        p.put(x, y + o, "cream.shade")
    p.put(3, 12 + o, "brass.base")                       # 황동 펜촉
    p.put(2, 13 + o, "brass.shade")
    p.put(3, 13 + o, "brass.hi")
    # 얼굴(깃 가운데)
    for x in (7, 10):
        p.put(x, 6 + o, "eye")
        p.put(x, 7 + o, "eye")
    p.put(6, 8 + o, "blush")
    p.put(11, 8 + o, "blush")
    p.put(12 + sway, 1 + o, "teal.hi")                   # 깃 끝의 청록 서리
    g = p.grid()
    # 펜촉의 잉크 방울: 맺힘 → 늘어짐 → 떨어짐 → (다시 맺히기 전 빈 프레임)
    drop = {0: [(2, 14 + o)], 1: [(2, 14 + o), (2, 15 + o)], 2: [(1, 15)], 3: []}[frame]
    g = [list(r) for r in g]
    for x, y in drop:
        if 0 <= y < 16:
            g[y][x] = c("cloth_indigo.shade")
    return ["".join(r) for r in g]


# ── 두루마리 뱀: 말린 두루마리 통(왼쪽, 끝면의 소용돌이), 거기서 풀린 종이 띠가 물결치며 오른쪽으로 기고
# 끝을 접어 만든 머리(눈, 봉랍 빨강 인장, 빨간 끈 혀)를 든다 ──────────────────────────────────────
_ROLL_TICK = ((2, 8), (4, 10), (2, 12), (0, 10))         # 소용돌이 끝 표시: 1/4씩 시계 방향으로 돈다


def _scroll(frame):
    p = Px()
    ph = frame * math.pi / 2
    band = set()
    ys = {}
    for x in range(4, 12):
        yc = round(11.5 + 1.3 * math.sin((x - 4) * 0.8 - ph))
        ys[x] = yc
        for y in (yc - 1, yc, yc + 1):
            band.add((x, y))
    p.mass(band, "cream")
    for x in range(4, 12):                               # 종이 띠의 글줄(남색 잉크, 두 칸 건너)
        if x % 3 == 1:
            p.put(x, ys[x], "cloth_indigo.shade")
    # 목과 머리: 띠 끝(11열)에서 위로 올라간다. 머리 높이는 띠 끝 물결을 따라 오르내린다
    hy = ys[11] - 7
    neck = {(x, y) for x in (11, 12) for y in range(hy + 3, ys[11])}
    p.mass(neck, "cream")
    head = ellipse(12.5, hy + 2.0, 2.8, 2.1)
    p.mass(head, "cream", lift=1)
    p.put(13, hy + 1, "eye")
    p.put(13, hy + 2, "eye")
    p.put(11, hy + 3, "brick.base")                      # 봉랍 인장
    p.put(10, hy + 3, "brick.hi")
    p.put(15, hy + 3, "brick.base")                      # 빨간 끈 혀
    p.put(15, hy + 4, "brick.shade")
    # 두루마리 통(끝면): 감긴 종이 둘레 + 나무 축
    roll = ellipse(2.5, 10.5, 2.5, 3.2)
    p.mass(roll, "cream")
    for x, y in ellipse(2.5, 10.5, 1.4, 2.0):
        p.put(x, y, "cream.shade")
    p.put(2, 10, "wood.base")
    p.put(2, 11, "wood.shade")
    tx, ty = _ROLL_TICK[frame]
    p.put(tx, ty, "cream.ol")
    return p.grid()


# ── 암호 부엉이: 빨간 책 위에 앉은 넓은 남색 부엉이. 양피지 얼굴판에 황동 바퀴 눈(바늘이 돈다), 가슴판의 글자가
# 한 칸씩 밀린다(A → B → C → D). 귀깃 대신 납작한 학사모와 황동 술 ───────────────────────────────
_LETTERS = {
    "A": (".W.", "W.W", "WWW", "W.W"),
    "B": ("WW.", "WW.", "W.W", "WW."),
    "C": (".WW", "W..", "W..", ".WW"),
    "D": ("WW.", "W.W", "W.W", "WW."),
}
_HAND = ((0, -1), (1, 0), (0, 1), (-1, 0))               # 바퀴 바늘: 12시 → 3시 → 6시 → 9시


def _owl(frame):
    p = Px()
    body = ellipse(8, 9.0, 6.2, 5.0)
    p.mass(body, "cloth_indigo", shade_below=12)
    for side in (1, 2, 13, 14):                          # 접은 날개(몸 옆, 한 단계 어둡게)
        for y in range(8, 13):
            if (side, y) in body:
                p.put(side, y, "cloth_indigo.shade" if side in (1, 2) else "cloth_indigo.ol")
    face = ellipse(5.5, 7.0, 2.6, 2.2) | ellipse(10.5, 7.0, 2.6, 2.2)   # 양피지 얼굴판(눈 둘레 두 원)
    for x, y in face:
        p.put(x, y, "cream.hi" if x < 8 else "cream.base")
    for ex in (5, 10):                                   # 황동 바퀴 눈 3×3: 테 + 가운데 눈동자 + 도는 바늘
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if dx or dy:
                    p.put(ex + dx, 7 + dy, "brass.base" if dx + dy < 0 else "brass.shade")
        p.put(ex, 7, "eye")
        hx, hy = _HAND[frame]
        p.put(ex + hx, 7 + hy, "cloth_indigo.ol")
    p.put(7, 9, "brass.hi")                              # 부리
    p.put(8, 9, "brass.shade")
    # 가슴판(양피지)과 글자
    for x in range(6, 11):
        for y in range(10, 14):
            p.put(x, y, "cream.base" if (x, y) != (6, 10) else "cream.hi")
    for j, row in enumerate(_LETTERS["ABCD"[frame]]):
        for i, v in enumerate(row):
            if v == "W":
                p.put(7 + i, 10 + j, "cloth_indigo.shade")
    # 학사모(납작한 판 + 가운데 단추), 오른쪽으로 늘어진 황동 술(0 → +1 → 0 → −1px 흔들림)
    for x in range(3, 14):
        p.put(x, 3, "brick.base" if x < 12 else "brick.shade")
    for x in range(5, 12):
        p.put(x, 2, "brick.hi" if x < 7 else "brick.base")
    p.put(8, 1, "brass.base")
    sw = (0, 1, 0, -1)[frame]
    for y in (4, 5):
        p.put(13 + (sw if y == 5 else 0), y, "brass.base")
    p.put(13 + sw, 6, "brass.hi")
    # 발 아래 빨간 책(표지 + 양피지 페이지 끝)
    for x in range(2, 14):
        p.put(x, 14, "brick.base" if x > 2 else "brick.hi")
        p.put(x, 15, "cream.hi" if 3 <= x <= 12 else "brick.shade")
    for x in (6, 10):                                    # 발가락
        p.put(x, 13, "brass.base")
    return p.grid()


LIBRARY_MONSTERS = {
    "monster_letter_moth": [_moth(i, dy) for i, dy in enumerate(FLY)],
    # 통통 튀는 몸: 기본(폭 12·높이 7) → 눌림(14·6) → 기본 → 늘어남(11·8, 잉크 방울)
    "monster_ink_slime": [_ink(12, 7, False), _ink(14, 6, False), _ink(12, 7, False), _ink(11, 8, True)],
    "monster_quill_sprite": [_quill(i, dy) for i, dy in enumerate(FLY)],
    "monster_scroll_snake": [_scroll(i) for i in range(4)],
    "monster_cipher_owl": [_owl(i) for i in range(4)],
}
