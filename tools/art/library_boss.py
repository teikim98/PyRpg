"""지역 4 보스(32×32 프레임 4개): 사서 골렘.

화풍 통일(docs/art-overhaul/style-guide.md §6.3, 기준 구현 forest_boss.py): 코지 팔레트만 쓰고 monsters.Px로 덩어리마다
3단 음영, auto_outline으로 1px 외곽선. 디자인은 옛 그림 그대로다.
- 몸통은 책이 꽂힌 나무 책장(두 칸), 가슴 한가운데에 지역 1~3 보스와 같은 황동 테·청록 문자판의 시계 룬.
- 머리는 황동 모서리를 댄 두꺼운 봉랍 빨강 책 한 권(오른쪽에 양피지 페이지 끝), 표지에 청록 눈 틈.
- 어깨와 팔은 층층이 쌓인 책(남색·양피지·빨강·가죽), 주먹은 네모난 책 한 권, 다리는 짧은 나무 기둥.
- 오른손(그림 오른쪽)에 키만 한 깃펜.

프레임(엔진은 맵·전투 모두 4프레임을 그대로 돌린다. 옛 [잠든, 깬]은 루프 안의 위협 프레임으로 옮겼다):
0 노려봄(눈 틈이 반쯤 덮임) → 1 숨 들이쉼(머리·어깨 1px 들림) → 2 노려봄(문자판 바늘이 한 칸 돎)
→ 3 위협(눈 틈이 크게 열려 환하게 빛나고 문자판이 밝아지며 깃펜을 3px 치켜듦, 머리 2px 들림).
"""
from cozypal import c
from monsters import Px, ellipse

SIZE = 32


def _rect(x0, y0, x1, y1):
    return {(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)}


# 몸통 책장 칸의 책: (x, 폭, 키, 램프) 위 칸 바닥 18행, 아래 칸 바닥 24행. 가운데(13~18열)는 시계 룬 자리
_TOP = [(9, 2, 4, "cloth_indigo"), (11, 1, 3, "cream"), (12, 1, 4, "brick"), (19, 2, 4, "leather"),
        (21, 1, 3, "cream"), (22, 1, 4, "cloth_indigo")]
_BOTTOM = [(9, 1, 4, "brick"), (10, 2, 5, "cream"), (12, 1, 3, "cloth_green"), (19, 1, 4, "cloth_indigo"),
           (20, 2, 5, "brick"), (22, 1, 3, "leather")]


def _book(p, x, w, h, ramp, floor):
    for dx in range(w):
        for k in range(h):
            step = "base" if dx == 0 else "shade"
            if k == h - 1:
                step = "hi" if dx == 0 else "base"
            p.put(x + dx, floor - k, f"{ramp}.{step}")


def _stack(p, x0, x1, y0, ramps):
    """가로로 쌓인 책 더미(팔): 권마다 2줄(표지 윗면 + 옆면), 오른쪽 끝에 페이지."""
    y = y0
    for i, ramp in enumerate(ramps):
        a, b = x0 + (i % 2), x1 - ((i + 1) % 2)
        for x in range(a, b + 1):
            p.put(x, y, f"{ramp}.hi" if x == a else f"{ramp}.base")
            p.put(x, y + 1, f"{ramp}.shade")
        p.put(b, y + 1, "cream.hi")
        y += 2
    return y


def _golem(frame):
    p = Px(SIZE, SIZE)
    threat = frame == 3
    lift = (0, 1, 0, 2)[frame]                 # 머리·어깨가 들리는 높이

    # 다리: 짧은 나무 기둥 두 개 + 넓은 발
    for x0 in (10, 18):
        p.mass(_rect(x0, 26, x0 + 3, 29), "wood", shade_below=29)
        p.mass(_rect(x0 - 1, 30, x0 + 4, 30), "wood")

    # 몸통: 책장 틀(나무), 칸 두 개
    p.mass(_rect(7, 12, 24, 26), "wood")
    for y in list(range(14, 19)) + list(range(20, 25)):
        for x in range(9, 23):
            p.put(x, y, "wood.ol")
    for x in range(8, 24):                                  # 선반
        p.put(x, 19, "wood.shade")
        p.put(x, 25, "wood.shade")
    for b in _TOP:
        _book(p, *b, floor=18)
    for b in _BOTTOM:
        _book(p, *b, floor=24)

    # 가슴의 시계 룬(8×8): 황동 테 + 청록 문자판 + 바늘(2번 프레임에 한 칸 돎)
    dial = ellipse(16, 19.5, 4.0, 4.0, SIZE)
    for x, y in dial:
        p.put(x, y, "brass.base" if x + y < 35 else "brass.shade")
    face = ellipse(16, 19.5, 2.9, 2.9, SIZE)
    for x, y in face:
        p.put(x, y, "teal.hi" if threat else "teal.base")
    p.put(14, 17, "teal.spec" if threat else "teal.hi")
    hands = [(15, 18), (15, 19)] if frame != 2 else [(16, 19), (17, 19)]
    for x, y in hands + [(15, 19)]:
        p.put(x, y, "ink")

    # 어깨·팔: 층층이 쌓인 책(들림 높이만큼 위로), 주먹은 책 한 권
    sy = 13 - lift
    _stack(p, 2, 7, sy, ("cloth_indigo", "cream", "brick", "leather", "cloth_indigo"))
    _stack(p, 24, 29, sy, ("brick", "cream", "cloth_indigo", "leather", "brick"))
    for x0 in (2, 25):                                      # 주먹(네모난 빨간 책)
        p.mass(_rect(x0, sy + 10, x0 + 4, sy + 12), "brick")
        p.put(x0 + 4 if x0 == 2 else x0, sy + 12, "cream.hi")

    # 머리: 두꺼운 빨간 책(황동 모서리, 오른쪽 페이지 끝, 제목 띠), 표지에 청록 눈 틈
    hy = 2 - lift + (0 if lift < 2 else 0)
    head = _rect(10, hy, 21, hy + 9)
    p.mass(head, "brick")
    for y in range(hy + 1, hy + 9):                         # 페이지 끝(오른쪽 두께)
        p.put(21, y, "cream.base" if y % 2 else "cream.shade")
    for x, y in ((10, hy), (11, hy), (10, hy + 1), (20, hy), (21, hy), (10, hy + 9), (11, hy + 9), (10, hy + 8),
                 (20, hy + 9), (21, hy + 9)):              # 황동 모서리
        p.put(x, y, "brass.hi" if y == hy else "brass.base")
    for x in range(12, 20):                                 # 제목 띠
        p.put(x, hy + 2, "brass.shade" if x % 3 else "brass.base")
    ey = hy + 5
    for x in range(12, 20):                                 # 눈 틈
        p.put(x, ey, "brick.ol")
        p.put(x, ey + 1, "teal.hi" if threat else "teal.base")
        p.put(x, ey + 2, "teal.base" if threat else "brick.ol")
    if threat:
        for x in range(12, 20):
            p.put(x, ey, "teal.base")
            p.put(x, ey - 1, "brick.ol")
        p.put(13, ey, "white")
        p.put(17, ey, "white")
        p.put(14, ey + 1, "teal.spec")
        p.put(18, ey + 1, "teal.spec")
    else:
        p.put(13, ey + 1, "teal.hi")                        # 반쯤 감긴 눈의 눈동자 빛
        p.put(17, ey + 1, "teal.hi")
    for x in (12, 13, 18, 19):                              # 눈썹(표지 장식 줄): 위협 때 위로
        p.put(x, ey - (2 if threat else 1), "brick.shade")

    # 깃펜(오른손 주먹에서 위로): 양피지 깃 + 깃대 + 황동 펜촉, 위협 때 3px 치켜듦
    qy = sy + 10 - (3 if threat else 0)
    for k in range(2, 13):                                  # 깃대
        p.put(27, qy - k, "cream.shade")
    vane = {(x, y) for y in range(qy - 13, qy - 3) for x in range(25, 31)
            if ((x + 0.5 - 27.5) / 2.6) ** 2 + ((y + 0.5 - (qy - 8)) / 5.2) ** 2 <= 1.0}
    for x, y in vane:
        if p.get(x, y) is None:
            p.put(x, y, "cream.hi" if x < 27 else "cream.base")
    p.put(27, qy - 13, "teal.hi")
    p.put(27, qy + 1, "brass.base")
    p.put(27, qy + 2, "brass.shade")
    g = p.grid()
    if threat:                                              # 깃 끝 반짝임
        g = [list(r) for r in g]
        y = qy - 15
        if 0 <= y and g[y][27] == ".":
            g[y][27] = c("sparkle")
        g = ["".join(r) for r in g]
    return g


LIBRARY_BOSSES = {"boss_librarian_golem": [_golem(i) for i in range(4)]}
