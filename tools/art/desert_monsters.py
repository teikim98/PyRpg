"""지역 7(모래시계 사막) 몬스터 7종(16×16 프레임 4개 제자리). 다섯은 주문서 몬스터, 둘(낙타 대상 유령·먼지 회오리)은
응용 전투용으로 주문서에 묶이지 않는다.

화풍 통일(docs/art-overhaul/style-guide.md §3·§6.2, 기준 구현 forest_monsters.py): 코지 팔레트(cozypal)의 이름 있는 색만
쓰고, monsters.Px로 덩어리마다 3단 음영(빛은 왼쪽 위)을 칠한 뒤 auto_outline(재질 ol)으로 바깥 외곽선을 두른다.
옛 디자인(정체·모양)은 그대로이고, 옛 팔레트의 반투명 색(유령·신기루)은 불투명한 밝은 램프(sky·teal)로 바꿔 읽히게 했다.

| 몬스터 | 정체(문제) | 4프레임 |
|---|---|---|
| 흐름 모래 정령 | 둥근 모래 머리 아래로 끊김 없이 흘러내리는 모래 줄기, 바닥의 작은 더미(입력 끝까지 읽기) | 나는 몸 0 → −1 → −2 → −1px(더미는 고정), 줄기의 모래알이 한 칸씩 흘러내림 |
| 모래 달팽이 | 왼쪽을 보는 옆모습의 낮고 긴 달팽이, 붉은 사암 껍데기에 황동 모래시계 무늬(시간복잡도) | 기어가기: 기본 → 몸을 앞으로 1px 늘임(눈자루 기욺) → 기본 → 몸을 당겨 껍데기가 1px 들림, 모래시계 모래알이 내려감 |
| 신기루 도마뱀 | 위에서 본 도마뱀, 몸에 일렁임 띠(찾기 비용) | 다리 두 벌이 번갈아(대각선 걸음), 꼬리 끝이 좌우로, 일렁임 띠가 한 줄씩 아래로 |
| 체 항아리 | 목이 좁고 배가 불룩한 손잡이 둘 토기 항아리, 바닥 구멍에서 모래가 샘(에라토스테네스의 체) | 나는 몸 0 → −1 → −2 → −1px(바닥 더미 고정), 새는 모래알이 한 칸씩 떨어짐 |
| 해시계 게 | 위에서 본 납작하고 넓은 게, 등딱지가 해시계 판, 큰 집게 둘(GCD·진법) | 바늘 그림자가 1/4칸씩 돌고, 다리 두 벌이 번갈아, 4번째에 집게를 닫음 |
| 낙타 대상 유령 | 왼쪽을 보는 옆모습의 창백한 낙타가 짐 꾸러미를 졌고 다리가 안개로 흩어짐(응용) | 나는 몸 0 → −1 → −2 → −1px, 다리 안개가 번갈아 |
| 먼지 회오리 | 위가 넓고 아래가 뾰족한 모래 깔때기에 별 조각(응용) | 띠가 1/4칸씩 돌고 깔때기가 S자로 흔들리며 별 조각이 돈다 |

지역 1~6과 실루엣이 겹치지 않게: 해시계 게는 지역 1 시계 딱정벌레(정면의 둥근 황동 회중시계)와 달리 가로로 납작한
붉은 게에 큰 집게 둘이 위로 솟고 판이 크림색, 모래 달팽이는 옆모습의 낮고 긴 몸, 체 항아리는 지역 6 겹연꽃 정령
(위가 벌어진 분홍 컵 꽃)과 달리 목이 좁고 배가 불룩한 주황 토기에 손잡이 고리 둘.
"""
import math

from cozypal import c
from monsters import FLY, Px, ellipse


def _eyes(p, y, xl, xr, blink=False, blush=True):
    """점 눈 1×2 + 볼터치(눈 아래 줄, 1px 바깥). blink면 아래 픽셀만 남기고 바깥쪽으로 1px 늘린 가로선."""
    for ex, out in ((xl, -1), (xr, 1)):
        if blink:
            p.put(ex, y + 1, "eye")
            p.put(ex + out, y + 1, "eye")
        else:
            p.put(ex, y, "eye")
            p.put(ex, y + 1, "eye")
    if blush:
        p.put(xl - 1, y + 2, "blush")
        p.put(xr + 1, y + 2, "blush")


# ── 흐름 모래 정령: 둥근 모래 머리 + 흘러내리는 모래 줄기 + 바닥 더미 ─────────────────────────────
def _sand_stream(frame, dy):
    """거꾸로 세운 물방울: 둥근 머리가 아래로 가늘어지며 모래 줄기가 되고, 줄기는 바닥 더미로 쌓인다.
    머리 위쪽은 해를 받은 밝은 모래(sand 한 단계 밝게), 아래쪽 절반은 주황 그늘(rust)."""
    p = Px()
    mound = {(x, y) for x, y in ellipse(8.8, 15.6, 5.0, 2.4) if y <= 14}
    p.mass(mound, "sand")
    cy = 4.8 + dy
    body = ellipse(8, cy, 4.8, 4.0)
    for y in range(int(cy) + 1, 13):                       # 머리에서 줄기로 가늘어지는 꼬리(오른쪽으로 살짝 휨)
        t = (y - cy) / (12 - cy)
        hw = max(0.6, 4.6 * (1 - t) ** 1.6)
        cx = 8 + (0.6 if t > 0.55 else 0)
        body |= {(x, y) for x in range(16) if abs(x + 0.5 - cx) <= hw}
    p.mass(body, "sand", lift=1)
    for x, y in body:                                      # 아래쪽 절반은 주황 그늘(한낮의 모래)
        if y > cy + 1.5:
            k = p.get(x, y).split(".")[1]
            p.put(x, y, {"spec": "rust.spec", "hi": "rust.hi", "base": "rust.base"}.get(k, "rust.shade"))
    for x, y in body:                                      # 흘러내리는 모래알: 프레임마다 한 칸씩 내려간다
        if y > cy + 3 and (y - frame) % 3 == 0 and p.get(x, y) in ("rust.hi", "rust.base"):
            p.put(x, y, "sand.spec")
    p.put(5, 2 + dy, "white")
    _eyes(p, 4 + dy, 6, 10)
    p.put(8, 1 + dy, "teal.hi")                            # 이마의 청록 룬 한 점
    return p.grid()


# ── 모래 달팽이: 옆모습(왼쪽을 봄), 붉은 사암 껍데기에 황동 모래시계 ──────────────────────────────
def _dune_snail(frame):
    p = Px()
    reach = (0, 1, 0, -1)[frame]          # 머리가 앞으로 나온 정도(+면 왼쪽으로 늘어남)
    lift = 1 if frame == 3 else 0          # 몸을 당길 때 껍데기가 1px 들린다
    # 몸(발): 낮고 긴 크림빛 몸, 머리는 왼쪽에서 솟는다
    x_head = 2 - reach
    foot = {(x, y) for x in range(x_head, 15) for y in (12, 13)} - {(14, 12)}
    neck = {(x, y) for x in range(x_head, x_head + 4) for y in range(8, 12)} - {(x_head, 8)}
    p.mass(foot | neck, "cream", lift=1, shade_below=13)
    for x in range(x_head + 1, 14, 3):                    # 발 아래 주름
        p.put(x, 13, "cream.shade")
    # 눈자루 둘(앞이 길다). 늘일 때 앞으로 기운다
    lean = -1 if reach > 0 else 0
    for sx, h in ((x_head + 1, 4), (x_head + 3, 3)):
        for k in range(1, h):
            p.put(sx + (lean if k == h - 1 else 0), 8 - k, "cream.base")
        p.put(sx + lean, 8 - h, "eye")
    p.put(x_head + 1, 10, "blush")
    # 껍데기: 붉은 사암 소용돌이(rust), 가운데 황동 모래시계
    cy = 7.2 - lift
    shell = ellipse(10.2, cy, 4.6, 4.4)
    p.mass(shell, "rust")
    for x, y in ellipse(10.2, cy, 3.0, 2.8) - ellipse(10.2, cy, 2.0, 1.8):   # 소용돌이 홈
        if p.get(x, y) == "rust.base":
            p.put(x, y, "rust.shade")
    oy = int(cy) - 2
    for x in (9, 10, 11):                                 # 모래시계 위·아래 가로대
        p.put(x, oy, "brass.hi")
        p.put(x, oy + 4, "brass.shade")
    for x, y in ((10, oy + 1), (10, oy + 2), (10, oy + 3)):
        p.put(x, y, "teal.base")
    grain = oy + 1 + (frame % 3)                          # 떨어지는 모래알
    p.put(10, grain, "sand.hi")
    p.put(8, oy - 1, "rust.spec")
    return p.grid()


# ── 신기루 도마뱀: 위에서 본 도마뱀, 일렁임 띠 ─────────────────────────────────────────────
def _mirage_lizard(frame):
    """위에서 본 도마뱀: 뾰족한 머리, 가는 몸, 네 다리를 옆으로 벌리고 발가락, 길게 휜 꼬리. 몸은 신기루 청록
    (teal 한 단계 밝게), 등에 짙은 점 줄, 일렁이는 띠(sky 강조)가 한 줄씩 아래로 지나간다."""
    p = Px()
    step = (0, 1, 0, -1)[frame]
    # 다리: 어깨(몸 옆)에서 옆으로 2px 뻗고 발끝은 앞(위)이나 뒤(아래)로. 대각선 두 다리가 함께 움직인다
    for i, (x, y, side) in enumerate(((6, 6, -1), (9, 6, 1), (6, 10, -1), (9, 10, 1))):
        fwd = step if i in (0, 3) else -step
        p.put(x + side, y, "teal.base")
        p.put(x + 2 * side, y - fwd, "teal.base")
        p.put(x + 3 * side, y - fwd - 1, "teal.shade")          # 발가락
        p.put(x + 3 * side, y - fwd, "teal.shade")
    sway = (0, 1, 0, -1)[frame]
    for x, y in ((8, 12), (8, 13), (9, 14), (10 + sway, 14), (11 + sway, 15)):   # 꼬리
        p.put(x, y, "teal.base")
    p.put(7, 12, "teal.base")
    body = ellipse(7.5, 8.6, 2.1, 3.9) | ellipse(7.5, 3.4, 2.1, 2.5) | {(7, 0), (8, 0)}
    p.mass(body, "teal", lift=1)
    for y in range(7, 12, 2):
        p.put(7, y, "teal.shade")
        p.put(8, y + 1, "teal.shade")
    band = (5, 7, 9, 11)[frame]
    for x in range(16):
        if (x, band) in body:
            p.put(x, band, "sky.spec" if x % 2 else "sky.hi")
    for ex in (6, 9):                                       # 눈(머리 양옆)
        p.put(ex, 3, "eye")
    p.put(6, 2, "white")
    return p.grid()


# ── 체 항아리: 목이 좁고 배가 불룩한 토기, 바닥 구멍에서 모래가 샌다 ───────────────────────────
_URN_ROWS = ((6, 9), (6, 9), (4, 11), (3, 12), (3, 12), (3, 12), (3, 12), (4, 11), (5, 10))  # (왼쪽, 오른쪽)
_HOLES = (6, 8, 10)


def _sieve_urn(frame, dy):
    p = Px()
    # 바닥의 모래 더미(고정)
    pile = {(x, y) for x, y in ellipse(8, 15.4, 4.2, 1.9) if y <= 14}
    p.mass(pile, "sand", lift=1)
    top = 2 + dy
    bottom = top + len(_URN_ROWS) - 1
    # 새는 모래 줄기(구멍 아래에서 더미까지), 모래알이 프레임마다 한 칸씩 떨어진다
    for hx in _HOLES:
        for y in range(bottom + 1, 14):
            if (y + hx - frame) % 3 == 0:
                p.put(hx, y, "sand.hi")
    # 손잡이 고리 둘(어깨에서 배로)
    for x, y in ((2, top + 2), (1, top + 3), (1, top + 4), (2, top + 5), (13, top + 2), (14, top + 3), (14, top + 4),
                 (13, top + 5)):
        p.put(x, y, "rust.shade")
    body = {(x, top + j) for j, (l, r) in enumerate(_URN_ROWS) for x in range(l, r + 1)}
    p.mass(body, "rust", shade_below=bottom)
    for x in range(6, 10):                                 # 입술(밝은 테)과 목 그늘
        p.put(x, top, "rust.hi")
        p.put(x, top + 1, "rust.shade")
    p.put(6, top, "rust.spec")
    for x in range(4, 12):                                 # 어깨의 크림 띠 무늬
        if x % 2 == 0:
            p.put(x, top + 3, "cream.hi")
    for hx in _HOLES:                                      # 바닥 구멍
        p.put(hx, bottom, "void")
    _eyes(p, top + 4, 6, 9, blink=frame == 3)
    p.put(4, top + 4, "rust.spec")
    return p.grid()


# ── 해시계 게: 위에서 본 납작하고 넓은 게, 등딱지 = 해시계 판 ─────────────────────────────────
def _sundial_crab(frame):
    p = Px()
    alt = frame % 2
    # 다리 셋씩(옆으로), 두 벌이 번갈아 1px 들림
    for k, y in enumerate((8, 10, 12)):
        up = 1 if (k + alt) % 2 else 0
        for x, side in ((2, -1), (13, 1)):
            p.put(x, y, "rust.shade")
            p.put(x + side, y - up, "rust.shade")
            p.put(x + 2 * side, y + 1 - up, "rust.ol")
    # 집게 둘(위로 솟음): 팔 + 손가락 둘이 V자로 벌어진 집게. 4번째 프레임에 닫는다
    claw_open = ((1, 0), (3, 0), (0, 1), (1, 1), (3, 1), (4, 1), (0, 2), (1, 2), (2, 2), (3, 2), (4, 2),
                 (1, 3), (2, 3), (3, 3))
    claw_shut = ((1, 0), (2, 0), (0, 1), (1, 1), (2, 1), (3, 1), (0, 2), (1, 2), (2, 2), (3, 2), (4, 2),
                 (1, 3), (2, 3), (3, 3))
    shape = claw_shut if frame == 3 else claw_open
    for ox, arm in ((0, (3, 4)), (11, (12, 4))):
        p.put(arm[0], arm[1] + 1, "cloth_red.shade")
        p.put(arm[0] + (1 if ox == 0 else -1), arm[1] + 2, "cloth_red.shade")
        cells = {(ox + (x if ox == 0 else 4 - x), y + 1) for x, y in shape}
        p.mass(cells, "cloth_red")
    # 등딱지(가로로 넓은 타원): 붉은 테 + 크림 해시계 판
    shell = ellipse(8, 9.6, 6.4, 4.2)
    p.mass(shell, "rust", shade_below=12)
    plate = ellipse(8, 9.4, 4.6, 2.9)
    p.mass(plate, "cream", lift=1)
    for x, y in ((8, 7), (12, 9), (8, 12), (4, 9), (11, 7), (5, 7)):   # 시각 눈금
        if (x, y) in plate:
            p.put(x, y, "cream.shade")
    # 바늘 그림자(1/4칸씩 돈다)와 황동 바늘
    ang = math.pi * (-0.35 + 0.3 * frame)
    for r in (1, 2, 3):
        x = round(7.5 + math.cos(ang) * r * 1.3)
        y = round(9.0 + math.sin(ang) * r * 0.8)
        if (x, y) in plate:
            p.put(x, y, "stone.shade")
    p.put(7, 9, "brass.hi")
    p.put(8, 9, "brass.shade")
    p.put(7, 8, "brass.spec")
    # 눈자루(판 위쪽)
    for ex in (6, 10):
        p.put(ex, 5, "eye")
        p.put(ex, 6, "rust.base")
    return p.grid()


# ── 낙타 대상 유령: 왼쪽을 보는 창백한 낙타, 짐 꾸러미, 다리가 안개로 ──────────────────────────
_CAMEL = """
.hh.............
hhhh............
hhEh.....PPPQ...
.hhh....PPpQQq..
..hh...rrrrrrr..
..hhhhbbbbbbbbb.
...hbbbbbbbbbbbb
....bbbbbbbbbbb.
....bbbbbbbbbb..
"""
_CAMEL_KEY = {"h": "sky.base", "b": "sky.base", "E": "teal.hi", "P": "cloth_indigo.base", "p": "cloth_indigo.shade",
              "Q": "cream.hi", "q": "cream.shade", "r": "leather.base"}
# 다리 넷(x)과 안개: 위 두 줄은 몸빛 다리(외곽선), 아래 두 줄은 외곽선 없이 흩어지는 안개 점. 두 벌이 번갈아 앞뒤로
_LEGS = ((5, 7, 11, 13), (4, 8, 10, 14))
_MIST = (((5, 0), (8, 0), (11, 0), (14, 0), (6, 1), (12, 1)), ((4, 0), (7, 0), (10, 0), (13, 0), (8, 1), (14, 1)))


def _caravan_ghost(frame, dy):
    p = Px()
    oy = 4 + dy
    lines = _CAMEL.strip("\n").splitlines()
    body = {(i, oy + j) for j, ln in enumerate(lines) for i, ch in enumerate(ln) if ch in "hbE"}
    legs = {(x, oy + 9 + k) for x in _LEGS[frame % 2] for k in (0, 1)}
    p.mass(body | legs, "sky", lift=1)
    for j, ln in enumerate(lines):
        for i, ch in enumerate(ln):
            if ch in "EPpQqr":
                p.put(i, oy + j, _CAMEL_KEY[ch])
    p.put(5, oy + 4, "sky.spec")                            # 혹 밝음
    g = [list(r) for r in p.grid()]
    for x, k in _MIST[frame % 2]:                           # 흩어지는 안개(외곽선 없이)
        y = oy + 12 + k
        if 0 <= y < 16 and g[y][x] == ".":
            g[y][x] = c("sky.hi") if k == 0 else c("sky.base")
    return ["".join(r) for r in g]


# ── 먼지 회오리: 위가 넓고 아래가 뾰족한 깔때기, 도는 띠, 별 조각 ────────────────────────────
_SWAY = (0, 0, 1, 1, 1, 0, 0, -1, -1, -1, 0, 0, 1, 1, 0, 0)


def _dust_devil(frame):
    p = Px()
    cells = {}
    for y in range(1, 15):
        half = max(0.7, 6.4 - (y - 1) * 0.45)
        cx = 8 + _SWAY[(y + frame * 2) % 16] * 0.8
        for x in range(16):
            if abs(x + 0.5 - cx) <= half:
                cells[(x, y)] = cx
    p.mass(set(cells), "sand", lift=1)
    for (x, y), cx in cells.items():                        # 비스듬한 띠: 프레임마다 1/4칸씩 돈다
        if p.get(x, y) in ("sand.hi", "sand.base") and int((x - cx) * 0.7 + y * 1.0 + frame) % 4 == 0:
            p.put(x, y, "rust.hi")
    stars = ((4, 3), (11, 5), (6, 8), (9, 11))
    for k, (x, y) in enumerate(stars):                      # 별 조각이 깔때기를 따라 돈다
        sx = x + (frame if k % 2 else -frame) % 3 - 1
        if (sx, y) in cells:
            p.put(sx, y, "cloth_indigo.spec" if k % 2 else "brass.hi")
    for x in (6, 10):                                       # 가는 눈 둘
        p.put(x + _SWAY[(4 + frame * 2) % 16], 4, "eye")
    g = p.grid()
    g = [list(r) for r in g]
    for i, (x, y) in enumerate(((1, 2), (14, 1), (0, 6), (15, 6))):  # 흩날리는 먼지(외곽선 없이)
        yy = (y + frame) % 8
        if g[yy][x] == ".":
            g[yy][x] = c("sand.hi") if i % 2 else c("sand.base")
    return ["".join(r) for r in g]


DESERT_MONSTERS = {
    "monster_sand_stream": [_sand_stream(i, dy) for i, dy in enumerate(FLY)],
    "monster_dune_snail": [_dune_snail(i) for i in range(4)],
    "monster_mirage_lizard": [_mirage_lizard(i) for i in range(4)],
    "monster_sieve_urn": [_sieve_urn(i, dy) for i, dy in enumerate(FLY)],
    "monster_sundial_crab": [_sundial_crab(i) for i in range(4)],
    "monster_caravan_ghost": [_caravan_ghost(i, dy) for i, dy in enumerate(FLY)],
    "monster_dust_devil": [_dust_devil(i) for i in range(4)],
}
