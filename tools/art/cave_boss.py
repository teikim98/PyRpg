"""지역 3 보스(32×32 프레임 4개): 고블린 족장.

화풍 통일(docs/art-overhaul/style-guide.md §6.3, 기준 구현 forest_boss.py): 코지 팔레트만 쓰고 monsters.Px로 덩어리마다
3단 음영, auto_outline으로 1px 외곽선. 디자인은 옛 그림 그대로다.
- 보물 왕관(황동, 가운데 붉은 보석·양옆 청록 보석), 옆으로 뻗은 큰 귀, 성난 눈썹, 아래턱에서 솟은 엄니.
- 어깨에 크림색 털 깃, 등에 빨간 망토, 가죽 조끼와 황동 버클.
- 가슴에 지역 1·2 보스와 같은 황동 테·청록 문자판의 시계 룬 목걸이(분침이 멈춰 있다).
- 오른손에 황동 왕홀, 끝에 청록 룬 구슬.

프레임(엔진은 맵·전투 모두 4프레임을 그대로 돌린다. 옛 [노려봄, 깸] 2프레임을 루프 안의 위협 프레임으로 옮김):
0 노려봄(눈꺼풀이 반쯤 덮임) → 1 숨 들이쉼(윗몸 1px 들림) → 2 노려봄(목걸이 분침이 한 칸 돎)
→ 3 위협(눈을 크게 뜨고 횃불빛으로 번쩍, 입을 벌려 엄니를 드러냄, 왕홀을 3px 치켜듦, 문자판·구슬이 환해짐).
"""
from cozypal import c
from monsters import Px, ellipse

SIZE = 32
SKIN = "leaf"      # 번호표 고블린·서기와 같은 피부(lift=1)


def _chief(frame):
    p = Px(SIZE, SIZE)
    up = (0, 1, 0, 1)[frame]           # 윗몸(머리·깃·팔)이 들리는 높이
    threat = frame == 3
    raise_ = 3 if threat else 0

    # 망토(뒤): 어깨에서 발치까지, 오른쪽 자락이 조금 더 길다
    cape = {(x, y) for x in range(5, 27) for y in range(14 - up, 30)
            if abs(x + 0.5 - 16) <= 7 + (y - 14) * 0.35 and not (y == 29 and x < 9)}
    p.mass(cape, "cloth_red", shade_below=26)
    # 다리와 장화
    for x0 in (11, 17):
        legs = {(x, y) for x in range(x0, x0 + 4) for y in range(25, 31)}
        p.mass(legs, "leather", shade_below=29)
        for x in range(x0 - 1, x0 + 4):
            p.put(x, 30, "leather.shade")
            p.put(x, 29, "leather.base")
    # 몸통(가죽 조끼) + 배 가죽끈과 황동 버클
    torso = ellipse(16, 21.5 - up, 7.6, 6.0, SIZE)
    p.mass(torso, "leather", shade_below=25)
    for x in range(9, 24):
        if (x, 25 - up) in torso:
            p.put(x, 25 - up, "leather.ol")
    for x, y, n in ((15, 25, "brass.hi"), (16, 25, "brass.base"), (17, 25, "brass.shade")):
        p.put(x, y - up, n)
    # 팔: 왼팔은 옆에 늘어뜨린 주먹, 오른팔은 왕홀을 쥔다
    larm = {(x, y) for x in range(5, 9) for y in range(17 - up, 25 - up)}
    p.mass(larm, SKIN, lift=1)
    rarm = {(x, y) for x in range(23, 27) for y in range(17 - up, 23 - up - raise_ // 2)}
    p.mass(rarm, SKIN, lift=1)
    # 털 깃(어깨를 두르는 크림색 털, 아래 가장자리가 들쭉날쭉)
    collar = {(x, y) for x, y in ellipse(16, 16.6 - up, 10.6, 2.6, SIZE)} | \
             {(x, 18 - up) for x in range(7, 26) if x % 3 != 0}
    p.mass(collar, "cream")
    # 시계 룬 목걸이: 황동 테 + 청록 문자판 + 분침
    cx, cy = 16, 21 - up
    face = "teal.hi" if threat else "teal.base"
    ring = [".UUU.", "UfffU", "UfffU", "UfffU", ".uuu."]
    for j, row in enumerate(ring):
        for i, ch in enumerate(row):
            if ch != ".":
                p.put(cx - 2 + i, cy - 2 + j, {"U": "brass.hi", "u": "brass.shade", "f": face}[ch])
    p.put(cx, cy, "ink")                                       # 축
    hand = (cx, cy - 1) if frame != 2 else (cx + 1, cy)       # 분침(2번 프레임에 한 칸 돎)
    p.put(*hand, "ink")
    if threat:
        p.put(cx - 1, cy - 1, "teal.spec")
    for x, y in ((12, 19), (20, 19)):                          # 목걸이 줄
        p.put(x, y - up, "brass.base")

    # 머리 + 옆으로 뻗은 큰 귀
    hy = 10 - up
    head = ellipse(16, hy + 0.5, 6.6, 5.4, SIZE)
    for side in (-1, 1):                                       # 귀: 머리 옆에서 바깥 위로 뾰족하게
        for k in range(6):
            x = 16 + side * (6 + k)
            for y in range(hy - 1 + k // 2, hy + 3 - k // 3):
                head.add((x if side > 0 else x - 1, y))
    p.mass(head, SKIN, lift=1)
    for side in (-1, 1):                                       # 귀 안쪽 그늘
        for k in range(1, 4):
            x = 16 + side * (7 + k) - (1 if side < 0 else 0)
            p.put(x, hy + 1, f"{SKIN}.base")
    # 눈: 노려봄은 눈꺼풀이 위를 덮고, 위협은 크게 뜨고 횃불빛으로 번쩍
    for ex in (12, 18):
        if threat:
            for dx in (0, 1):
                p.put(ex + dx, hy, "lamp.hi")
                p.put(ex + dx, hy + 1, "lamp.base")
            p.put(ex, hy, "lamp.spec")
        else:
            p.put(ex, hy + 1, "cream.spec")
            p.put(ex + 1, hy + 1, "eye")
            p.put(ex, hy, f"{SKIN}.base")
            p.put(ex + 1, hy, f"{SKIN}.base")
    # 성난 눈썹(가운데로 내려온다)
    by = hy - 2 - (1 if threat else 0)
    for dx, dy in ((0, 0), (1, 0), (2, 1)):
        p.put(11 + dx, by + dy, f"{SKIN}.ol")
        p.put(20 - dx, by + dy, f"{SKIN}.ol")
    # 코
    p.put(15, hy + 2, f"{SKIN}.base")
    p.put(16, hy + 2, f"{SKIN}.shade")
    # 입과 엄니
    my = hy + 4
    if threat:
        for x in range(12, 20):
            p.put(x, my, "cloth_red.ol")
            if 13 <= x <= 18:
                p.put(x, my + 1, "cloth_red.shade")
        for x in (12, 19):
            p.put(x, my - 1, "white")
            p.put(x, my, "white")
    else:
        for x in range(12, 20):
            p.put(x, my, f"{SKIN}.ol")
        for x in (12, 19):
            p.put(x, my - 1, "white")
    # 왕관: 황동 띠 + 뾰족한 끝 넷, 가운데 붉은 보석, 양옆 청록 보석
    ky = hy - 5
    crown = {(x, y) for x in range(10, 22) for y in range(ky + 1, ky + 3)}
    for x in (10, 13, 18, 21):
        crown |= {(x, ky), (x, ky - 1)}
    crown |= {(15, ky - 1), (16, ky - 1), (15, ky - 2), (16, ky - 2), (15, ky), (16, ky)}
    p.mass(crown, "brass", lift=1)
    for x, y, n in ((15, ky, "cloth_red.hi"), (16, ky, "cloth_red.base"), (15, ky + 1, "cloth_red.base"),
                    (16, ky + 1, "cloth_red.shade"), (12, ky + 2, "teal.hi"), (19, ky + 2, "teal.base")):
        p.put(x, y, n)

    # 왕홀(오른손): 황동 막대, 끝에 청록 룬 구슬
    sx = 27
    top = 5 - raise_
    for y in range(top + 3, 29 - raise_):
        p.put(sx, y, "brass.hi")
        p.put(sx + 1, y, "brass.shade")
    orb = ellipse(sx + 1, top + 1.5, 2.3, 2.3, SIZE)
    p.mass(orb, "teal", lift=1 if threat else 0)
    p.put(sx, top + 1, "white" if threat else "teal.spec")
    fist = {(x, y) for x in range(25, 30) for y in range(21 - up - raise_, 24 - up - raise_)}
    p.mass(fist, SKIN, lift=1)
    g = p.grid(skip=("sparkle",))
    if threat:                                                 # 구슬 옆 반짝임
        g = [list(r) for r in g]
        y = max(0, top - 1)
        if g[y][31] == ".":
            g[y][31] = c("sparkle")
        g = ["".join(r) for r in g]
    return g


CAVE_BOSSES = {"boss_goblin_chief": [_chief(i) for i in range(4)]}
