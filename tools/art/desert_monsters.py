"""지역 7(모래시계 사막) 몬스터 7종(16×16 프레임 2개). 다섯은 주문서 몬스터, 둘(낙타 대상 유령·먼지 회오리)은 응용 전투용으로
주문서에 묶이지 않는다.

몸통은 외곽선 없이 칠한 뒤 color_outline()으로 재질에 맞는 색 외곽선을 두른다(누리의 화풍).
대칭인 몸은 왼쪽 절반(8칸)만 그리고 sym()으로 좌우를 맞춘다. 빛은 왼쪽 위에서 온다.
지역 1~6 몬스터와 실루엣이 겹치지 않게:
흐름 모래 정령은 둥근 머리 아래가 가늘게 흘러내리는 모래 줄기와 작은 모래 더미(물방울을 거꾸로 세운 모양),
모래 달팽이는 옆모습(왼쪽을 봄)의 낮고 긴 달팽이로 껍데기에 금빛 모래시계 무늬가 있다(지역 1 시계 딱정벌레의
정면 둥근 몸·문자판과 다르다), 신기루 도마뱀은 위에서 본 반투명 도마뱀(네 다리를 벌리고 꼬리가 휜다),
체 항아리는 목이 좁고 배가 불룩한 손잡이 둘 달린 토기 항아리로 바닥 구멍에서 모래가 샌다(지역 6 겹연꽃 정령의
위가 벌어진 컵 모양 분홍 꽃과 다르다), 해시계 게는 위에서 본 둥근 해시계 판이 몸 전체를 덮고 집게와 다리가
판 밖으로 나온다(지역 3·5 게들과 달리 등딱지가 둥근 문자판), 낙타 대상 유령은 옆모습의 반투명 낙타가 짐 꾸러미를
졌고 다리가 안개로 흩어진다, 먼지 회오리는 위가 넓고 아래가 뾰족한 깔때기에 별 조각이 박혔다.
"""
from gridlib import overlay
from desertpal import CH, color_outline, paint, shade_right, sym


# ── 흐름 모래 정령(입력 끝까지 읽기): 둥근 모래 머리에 청록 눈, 몸 아래는 끊김 없이 흘러내리는 모래 줄기가
# 바닥의 작은 더미로 쌓인다. 프레임 B는 줄기의 알갱이가 한 칸 흘러내리고 더미가 조금 커진다 ─────────────────
STREAM_KEY = {"6": "d6", "5": "d5", "4": "d4", "3": "d3", "2": "d2", "1": "d1", "C": "i5", "c": "i2"}

_STREAM_HEAD = sym("""
    ........
    ......45
    ....4455
    ...44556
    ..445566
    ..45Cc56
    ..445555
    ..344555
    ...34455
    ....3344
""")
_STREAM_A = """
    ......3454......
    .......4453.....
    ........445.....
    .........44.....
    ........4..5....
    .....2334555....
"""
_STREAM_B = """
    ......3445......
    .......4543.....
    ........454.....
    .........4......
    ........5.4.....
    ....23345552....
"""


def _sand_stream(flow: bool):
    head = paint(_STREAM_HEAD, STREAM_KEY, 16, 10)
    tail = paint(_STREAM_B if flow else _STREAM_A, STREAM_KEY, 16, 6)
    g = head + tail
    g = shade_right(g, 8, skip=("i5", "i2"))
    return color_outline(g)


# ── 모래 달팽이(시간복잡도): 왼쪽을 보는 옆모습. 낮고 긴 흰 모래빛 몸, 머리 위 눈자루 둘, 등에 붉은 사암빛 껍데기와
# 금빛 모래시계 무늬(위·아래 가로대, 위 유리의 모래가 목을 지나 아래로). 프레임 B는 몸을 앞으로 한 칸 늘이고
# 눈자루가 기울며 모래시계의 모래가 한 알 내려간다 ──────────────────────────────────────────
SNAIL_KEY = {"5": "r5", "4": "r4", "3": "r3", "2": "r2", "G": "g4", "g": "g2", "S": "d5", "s": "d4",
             "B": "b5", "b": "b3", "c": "b2", "e": "eye"}
_SNAIL_A = """
    ................
    ................
    ................
    .B..B....4443...
    .b..b...455543..
    ..b.b..4GGGGG43.
    ..bbbb.45gSSg432
    .Bbebb.455gg5432
    .bbbbb.45gsSg432
    .bbbbb.4GGGGG432
    ..bbbb.34444432.
    ...bbbbb333332..
    ..cbbbbbbbbbbbc.
    .ccccccccccccc..
    ................
    ................
"""
_SNAIL_B = """
    ................
    ................
    ................
    B...B....4443...
    b..b....455543..
    .b.b...4GGGGG43.
    .bbbbb.45gS5g432
    Bbebbb.455gg5432
    bbbbbb.45gSSg432
    .bbbbb.4GGGGG432
    ..bbbb.34444432.
    ..bbbbbb333332..
    .cbbbbbbbbbbbbc.
    cccccccccccccc..
    ................
    ................
"""


def _dune_snail(stretch: bool):
    g = paint(_SNAIL_B if stretch else _SNAIL_A, SNAIL_KEY, 16, 16)
    return color_outline(g)


# ── 신기루 도마뱀(찾기 비용): 위에서 본 반투명 청록 도마뱀. 네 다리를 벌리고 꼬리가 오른쪽으로 휜다. 몸에 보랏빛
# 일렁임 띠가 지나가고(프레임 B는 띠가 아래로 옮겨 가고 꼬리 끝이 반대로 휜다) 눈만 또렷하다 ─────────────────
LIZARD_KEY = {"4": "m4", "3": "m3", "2": "m2", "1": "m1", "e": "eye", "U": "u4", "u": "u3"}
_LIZARD_BODY = sym("""
    ........
    ........
    ......33
    .....334
    .....e44
    ......34
    .23..334
    ..334444
    ....3444
    ....3444
    ....3444
    ..334444
    .23..344
    ......34
    ........
    ........
""")
_TAIL_A = paint("""
    ........
    ...33...
    ....32..
    .....32.
    ......2.
    ........
""", LIZARD_KEY, 8, 6)
_TAIL_B = paint("""
    ........
    ....33..
    ...23...
    ..23....
    ..2.....
    ........
""", LIZARD_KEY, 8, 6)


def _mirage_lizard(shift: bool):
    g = paint(_LIZARD_BODY, LIZARD_KEY, 16, 16)
    g = shade_right(g, 8, skip=("eye", "m4"))
    # 일렁임 띠(몸 위의 칸만 보랏빛으로)
    rows = [list(r) for r in g]
    for y in ((7, 8) if not shift else (10, 11)):
        for x in range(16):
            if rows[y][x] != ".":
                rows[y][x] = CH["u4" if (x + y) % 2 else "u3"]
    g = ["".join(r) for r in rows]
    g = overlay(g, _TAIL_B if shift else _TAIL_A, 3 if shift else 5, 12)
    return color_outline(g)


# ── 체 항아리(소수의 체): 목이 좁고 배가 불룩한 토기 항아리 정령. 양옆에 고리 손잡이, 배에 눈과 작은 입,
# 바닥에 구멍 넷이 뚫려 모래가 줄줄 샌다. 프레임 B는 새는 모래가 한 칸 내려가고 구멍 아래 더미가 생긴다 ──────────
URN_KEY = {"5": "a5", "4": "a4", "3": "a3", "2": "a2", "1": "a1", "o": "k0", "e": "eye", "w": "white", "m": "k1",
           "S": "d5", "s": "d4"}
_URN = sym("""
    ........
    ...34444
    ...23333
    .....445
    ....4455
    ..445555
    .2445555
    2.4we555
    2.445555
    .2445m55
    ..344455
    ..334444
    ...3o3o3
    ........
    ........
    ........
""")
_LEAK_A = """
    ....S.S..S.S....
    ....s...s..s....
    .......s.....s..
"""
_LEAK_B = """
    ....s.S..S.s....
    ....S.s..s.S....
    ...ss.S..S.ss...
"""


def _sieve_urn(drip: bool):
    g = paint(_URN, URN_KEY, 16, 16)
    g = shade_right(g, 8, skip=("eye", "white", "k0", "k1"))
    g = color_outline(g)
    leak = paint(_LEAK_B if drip else _LEAK_A, URN_KEY, 16, 3)
    return overlay(g, leak, 0, 13)


# ── 해시계 게(GCD·진법): 위에서 본 게. 몸 전체가 둥근 해시계 판(흰 돌 + 금테, 둘레에 시각 눈금)이고 가운데 금
# 바늘(삼각 그노몬)의 그림자가 프레임마다 돈다(A는 오른쪽 아래, B는 왼쪽 아래). 판 위로 눈자루 둘과 붉은 집게,
# 양옆으로 다리 셋씩 ────────────────────────────────────────────────────────────
CRAB_KEY = {"5": "r5", "4": "r4", "3": "r3", "2": "r2", "e": "eye", "W": "white"}
_CRAB_LIMBS = """
    .45..........54.
    4554........4554
    45.4.W....W.4.54
    .44..e....e..44.
    ..4..........4..
    ................
    3..............3
    .3............3.
    3..............3
    .3............3.
    3..............3
    .3............3.
    ................
    ................
    ................
    ................
"""


def _sundial_crab(turn: bool):
    g = [["."] * 16 for _ in range(16)]
    cx, cy = 7.5, 8.5
    for y in range(16):
        for x in range(16):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if d <= 5.6:
                if d > 4.6:
                    c = "g3" if (x - cx) + (y - cy) < 0 else "g2"
                else:
                    c = "b4" if (x - cx) + (y - cy) < -1 else "b3" if (x - cx) + (y - cy) < 3 else "b2"
                g[y][x] = c
    # 시각 눈금(판 둘레 안쪽 12곳 가운데 잘 보이는 8곳)
    for x, y in ((7, 4), (8, 4), (11, 5), (12, 8), (11, 12), (7, 13), (4, 12), (3, 8), (4, 5)):
        g[y][x] = "b1"
    # 바늘 그림자(짙은 선)와 금 바늘(삼각)
    shadow = [(9, 10), (10, 11), (11, 11)] if not turn else [(6, 10), (5, 11), (4, 11)]
    for x, y in shadow:
        g[y][x] = "k3"
    for x, y, c in ((7, 7, "g4"), (8, 7, "g3"), (7, 8, "g4"), (8, 8, "g2"), (7, 9, "g3"), (8, 9, "g2")):
        g[y][x] = c
    body = ["".join("." if c == "." else CH[c] for c in row) for row in g]
    limbs = paint(_CRAB_LIMBS, CRAB_KEY, 16, 16)
    if turn:
        # 집게를 한 칸 벌리고 다리를 바꿔 디딘다
        limbs = [r[1:] + "." if y < 5 else r for y, r in enumerate(limbs)]
        limbs = [r[:8] + "." + r[8:15] if y < 5 else r for y, r in enumerate(limbs)]
        limbs = [r[1:] + r[0] if 6 <= y <= 11 else r for y, r in enumerate(limbs)]
    g = overlay(limbs, body)
    return color_outline(g)


# ── 낙타 대상 유령(응용 통합형): 왼쪽을 보는 반투명 청백 낙타 유령. 혹 위에 남청·흰 짐 꾸러미를 줄로 묶어 졌고
# 눈은 청록으로 빛난다. 다리는 아래로 갈수록 옅어져 안개로 흩어진다. 프레임 B는 몸이 한 칸 떠오르고 다리 안개가 바뀐다 ──
GHOST_KEY = {"4": "h4", "3": "h3", "2": "h2", "1": "h1", "e": "i3", "Q": "q3", "q": "q2", "T": "t3", "t": "t2",
             "r": "w3"}
_CAMEL = """
    ................
    ..34............
    .3443...........
    34e43....TTQQ...
    .3343...tTTQQq..
    ...43..3rrrrrr3.
    ...44334444444..
    ....44444444443.
    ....344444444...
    .....33....33...
"""
_LEGS_A = """
    .....3.3...3.3..
    .....2.2...2.2..
    .....1.....1.1..
    ......1.....1...
    ................
    ................
"""
_LEGS_B = """
    ....3..3..3..3..
    ....2..2..2...2.
    .....1..1....1..
    ................
    ................
    ................
"""


def _caravan_ghost(float_: bool):
    body = paint(_CAMEL, GHOST_KEY, 16, 10)
    legs = paint(_LEGS_B if float_ else _LEGS_A, GHOST_KEY, 16, 6)
    g = body + legs
    if float_:
        g = g[1:] + ["." * 16]
    return color_outline(g)


# ── 먼지 회오리(응용 판별형): 위가 넓고 아래가 뾰족한 모래 깔때기가 S자로 흔들린다. 비스듬한 띠가 돌아가고
# 별 조각(금·흰·하늘) 몇 개가 박혀 반짝인다. 위쪽에 가는 눈 둘. 프레임 B는 띠가 한 칸 돌고 별이 자리를 옮긴다 ─────
_SWAY = (0, 0, 0, 1, 1, 1, 0, 0, -1, -1, -1, 0, 0, 1, 1, 0)


def _dust_devil(spin: bool):
    ph = 1 if spin else 0
    g = [["."] * 16 for _ in range(16)]
    for y in range(1, 15):
        half = max(0.6, 6.6 - (y - 1) * 0.45)
        cx = 7.5 + _SWAY[(y + ph) % 16] * 0.8
        for x in range(16):
            if abs(x - cx) <= half:
                band = int((x - cx) * 0.6 + 1.5 * y + 2 * ph) % 3
                c = ("d6", "d4", "d3")[band]
                if abs(x - cx) > half - 1:
                    c = "d3" if x < cx else "d2"
                g[y][x] = c
    stars = [(4, 3, "g4"), (11, 5, "b5"), (6, 8, "v6"), (9, 11, "g4")] if not spin else \
            [(10, 3, "g4"), (5, 5, "b5"), (9, 8, "v6"), (6, 11, "g4")]
    for x, y, c in stars:
        if g[y][x] != ".":
            g[y][x] = c
    # 깔때기 둘레에 흩날리는 모래 먼지
    puffs = [(1, 2), (14, 1), (0, 5), (15, 6)] if not spin else [(2, 1), (13, 2), (1, 6), (14, 4)]
    for x, y in puffs:
        g[y][x] = "d5"
    # 가는 눈 둘(위쪽, 띠 위에)
    for x in (6, 9):
        g[4][x] = "k1"
    out = ["".join("." if c == "." else CH[c] for c in row) for row in g]
    return color_outline(out)


DESERT_MONSTERS = {
    "monster_sand_stream": [_sand_stream(False), _sand_stream(True)],
    "monster_dune_snail": [_dune_snail(False), _dune_snail(True)],
    "monster_mirage_lizard": [_mirage_lizard(False), _mirage_lizard(True)],
    "monster_sieve_urn": [_sieve_urn(False), _sieve_urn(True)],
    "monster_sundial_crab": [_sundial_crab(False), _sundial_crab(True)],
    "monster_caravan_ghost": [_caravan_ghost(False), _caravan_ghost(True)],
    "monster_dust_devil": [_dust_devil(False), _dust_devil(True)],
}
