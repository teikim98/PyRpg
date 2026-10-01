"""지역 3(고블린 동굴) 지형 타일(16×16). manifest의 overworld 타일셋 끝에 이 순서대로 붙는다.

- 바닥류(cave_floor, minecart_rail, cave_pool)는 가장자리가 이어지게 그린다.
- 벽은 두 가지: 바닥과 맞닿은 앞면(cave_wall: 위 턱 + 층층이 쌓인 바위 덩이 + 밑동 그늘)과
  그 뒤의 바위 덩어리 윗면(cave_wall_top: 더 어둡고 울퉁불퉁). 맵 생성기가 바로 아래 칸을 보고 고른다.
- 벽 앞면 변형: torch_frozen(얼어붙은 횃불, 청록 서리에 갇힌 주황 불꽃), mural_wall(바랜 벽화: 멈춘 시계에
  손을 뻗은 두건 쓴 형상), cave_crack(지나갈 수 있는 바위 틈: 앞면 가운데가 세로로 갈라져 있고 틈 안쪽에
  찬 바람이 새는 청록 반짝임 두 점. 멀리서는 벽과 비슷하지만 보면 알 수 있게).
- 물체류(crystal, rubble, treasure_pile, bone_pile)는 동굴 바닥을 깔고 색 외곽선을 두른 물체를 얹는다.
"""
from cavepal import CH, color_outline, paint
from forestpal import Rng
from gridlib import overlay

FLOOR_KEY = {"0": "d0", "1": "d1", "2": "d2", "3": "d3", "4": "d4", "5": "d5", "6": "d6", "t": "i3"}

CAVE_FLOOR = paint("""
    3333333333333333
    3333233333333333
    3332433333333433
    3333333333333323
    3333333334433333
    3423333335543333
    3333333332223333
    3333333333333333
    3333333333332333
    3333233333334333
    3333333333333333
    3345333333333333
    3352233332333333
    3322333333333333
    3333333333342333
    3333333333333333
""", FLOOR_KEY, 16, 16)


def _rock_face(seed: int):
    """벽 앞면: 위 턱(0~2행), 크기가 제각각인 바위 덩이(3~13행), 밑동 그늘(14~15행). 가로로 이어진다.
    덩이는 씨앗 점에서 가장 가까운 칸끼리 묶고(가로로 감싸 이어짐), 덩이마다 위·왼쪽은 밝고 아래·오른쪽은 어둡다."""
    g = [[3] * 16 for _ in range(16)]
    rng = Rng(seed)
    # 위 턱: 밝은 가장자리, 울퉁불퉁
    lip = [5, 6, 6, 5, 5, 6, 5, 5, 6, 6, 5, 5, 5, 6, 5, 5]
    for x in range(16):
        g[0][x] = lip[x]
        g[1][x] = 4 if lip[x] == 6 else 5 if (x % 5 == 2) else 4
        g[2][x] = 2 if x % 3 else 1
    seeds = [(rng.randint(0, 15) + 0.5, 3 + rng.randint(0, 10) + 0.5) for _ in range(5)]
    seeds = [(2.5, 5.0), (9.0, 4.5), (14.5, 7.0), (5.5, 10.5), (11.5, 11.5)] if seed == 7 else seeds

    def label(x, y):
        best, bd = 0, 1e9
        for k, (sx, sy) in enumerate(seeds):
            dx = min(abs(x + 0.5 - sx), 16 - abs(x + 0.5 - sx))
            d = dx * dx * 0.8 + (y + 0.5 - sy) ** 2 * 1.4
            if d < bd:
                best, bd = k, d
        return best

    lab = {(x, y): label(x, y) for y in range(3, 14) for x in range(16)}
    for y in range(3, 14):
        for x in range(16):
            L = lab[(x, y)]
            right = lab[((x + 1) % 16, y)]
            below = lab.get((x, y + 1), -1)
            above = lab.get((x, y - 1), -1)
            left = lab[((x - 1) % 16, y)]
            if right != L or below != L and y < 13:
                v = 1  # 덩이 사이 이음매
            elif above != L or left != L:
                v = 4  # 빛 받는 위·왼쪽 가장자리
            elif lab.get((x, y + 2), -1) != L or lab[((x + 2) % 16, y)] != L:
                v = 2  # 그늘진 아래·오른쪽
            else:
                v = 3
            g[y][x] = v
    # 맨 위 덩이 줄의 윗가장자리는 턱 그늘 바로 밑이라 한 단계 밝게
    for x in range(16):
        if g[3][x] == 3:
            g[3][x] = 4
    # 덩이 안 잔무늬(밝은 점·어두운 점)
    for _ in range(8):
        x, y = rng.randint(0, 15), rng.randint(5, 12)
        if g[y][x] == 3:
            g[y][x] = 2 if rng.randint(0, 2) else 5
    for x in range(16):
        g[13][x] = min(g[13][x], 2)
        g[14][x] = 1
        g[15][x] = 0 if x % 4 else 1
    return g


def _ramp_rows(g, ramp: str):
    return ["".join(CH[f"{ramp}{v}"] for v in row) for row in g]


CAVE_WALL = _ramp_rows(_rock_face(7), "c")


def _wall_top():
    """바위 덩어리 윗면: 짙은 바탕에 둥근 혹(왼쪽 위가 살짝 밝다)과 틈. 가로·세로로 이어진다."""
    g = [[1] * 16 for _ in range(16)]
    bumps = [(3, 3, 2.6), (11, 2, 2.2), (8, 9, 3.0), (1, 11, 2.0), (14, 11, 2.4), (5, 14, 1.8), (12, 15, 1.6)]
    for cx, cy, r in bumps:
        for y in range(-3, 19):
            for x in range(-3, 19):
                dx, dy = x + 0.5 - cx, y + 0.5 - cy
                d = (dx * dx + dy * dy) ** 0.5
                if d <= r:
                    lit = -(dx * 0.6 + dy * 0.8) / r
                    v = 2 if lit < 0.35 else 3
                    if d > r - 0.8 and lit < -0.2:
                        v = 0
                    g[y % 16][x % 16] = v
    return _ramp_rows(g, "c")


CAVE_WALL_TOP = _wall_top()

# ── 얼어붙은 횃불: 벽 앞면에 쇠 고리, 나무 자루, 청록 얼음에 갇힌 채 멈춘 주황 불꽃 ──────────
TORCH_KEY = {"m": "m1", "M": "m3", "N": "m4", "w": "w2", "W": "w4", "a": "f1", "b": "f2", "c": "f3",
             "1": "i1", "2": "i2", "3": "i3", "4": "i4", "5": "i5", "r": "f0"}
TORCH = color_outline(paint("""
    ......4.........
    .....343..5.....
    ....33b23.......
    ...23bcb32......
    ...2abcca2......
    ...3abcba3.4....
    ...23aba32......
    ....3rar3.......
    .....2W2........
    .....wWw........
    ....MNWNM.......
    ....mmwmm.......
    ......w.........
    ................
    ................
    ................
""", TORCH_KEY, 16, 16))
TORCH_FROZEN = overlay(CAVE_WALL, [r[-3:] + r[:-3] for r in TORCH])  # 가운데로 3칸 옮김

# ── 벽화: 바랜 황토·청록 물감. 두건 쓴 형상이 바늘 멈춘 시계에 손을 뻗고 있다 ────────────
MURAL_KEY = {"o": "g1", "O": "g2", "t": "i1", "T": "i2", "x": "r1", "X": "r0", "w": "b2", "p": "c4", "P": "c5", "b": "c2"}
MURAL = paint("""
    ................
    ................
    ................
    bbbbbbbbbbbbbbbb
    ppPppppppppppPpp
    pxxppppppTTTpppp
    xxxxpppppTpwTppp
    pxxppppTpwwwpTpp
    xxxxxxpTpppppTpp
    pxxpppppTpppTppp
    pxpxpppppTTTpppp
    xppxpppppppppppp
    ooooOoooooOoooOo
    bbbbbbbbbbbbbbbb
    ................
    ................
""", MURAL_KEY, 16, 16)
MURAL_WALL = overlay(_ramp_rows(_rock_face(11), "c"), MURAL)

# ── 바위 틈(지나갈 수 있음): 앞면 가운데가 위에서 아래로 갈라져 있다. 틈 안은 깊은 어둠, 찬 바람 반짝임 두 점 ──
CRACK_KEY = {"0": "c0", "1": "c1", "2": "c2", "4": "c4", "t": "i3", "T": "i4"}
CRACK = paint("""
    ......400.......
    ......4001......
    ......4000......
    .....40001......
    .....4000.......
    .....4000.......
    ......40t01.....
    ......40001.....
    .......4000.....
    ......40000.....
    .....4000T......
    .....400001.....
    ......40000.....
    ......40000.....
    .....4000001....
    ....400000001...
""", CRACK_KEY, 16, 16)
CAVE_CRACK = overlay(CAVE_WALL, CRACK)


def on_floor(text: str, legend: dict, base=None, outline: bool = True):
    """동굴 바닥 위에 물체를 얹는다. '_'·'-'는 외곽선 없이 바닥에 직접 칠하는 그림자."""
    shadow_key = {"_": "d2", "-": "d1"}
    obj_rows, shadow_rows = [], []
    for line in [r.strip() for r in text.strip("\n").splitlines() if r.strip()]:
        obj_rows.append("".join("." if ch in shadow_key else ch for ch in line))
        shadow_rows.append("".join(ch if ch in shadow_key else "." for ch in line))
    obj = paint("\n".join(obj_rows), legend, 16, 16)
    if outline:
        obj = color_outline(obj)
    shadow = paint("\n".join(shadow_rows), shadow_key, 16, 16)
    return overlay(overlay(base or CAVE_FLOOR, shadow), obj)


# ── 수정: 보라 수정 기둥 셋, 끝에 청록 서리 ─────────────────────────────────────
CRYSTAL_KEY = {"0": "v0", "1": "v1", "2": "v2", "3": "v3", "4": "v4", "5": "v5", "t": "i3", "T": "i5"}
CRYSTAL = on_floor("""
    ................
    ......T.........
    ......54........
    .....5432.......
    .....5432...t...
    .....5432..43...
    ..4..5432.5432..
    .432.5432.5321..
    .432.54321532...
    .4321543215321..
    .4321543215321..
    ..321543215321..
    ..2215432153211.
    ...1111111111...
    ..____________..
    ................
""", CRYSTAL_KEY)

# ── 무너진 돌무더기 ─────────────────────────────────────────────────────────
RUBBLE_KEY = {"1": "c2", "2": "c3", "3": "c4", "4": "c5", "5": "c6", "a": "d2", "b": "d4", "B": "d5"}
RUBBLE = on_floor("""
    ................
    ................
    ................
    ................
    ......54........
    .....5432.......
    ...bB4332.Bb....
    ..bBBb221Bbbb...
    ..bbba11.bbba...
    .5432.54.aaa....
    543322543321....
    4332215432211b..
    .2211.3322.1Bba.
    ..____.1111_bba.
    ..........____..
    ................
""", RUBBLE_KEY)

# ── 보물 더미: 금화가 줄지어 쌓인 더미, 꼭대기에 빨간 보석 박힌 잔 ───────────────────
GOLD_KEY = {"0": "g0", "1": "g1", "2": "g2", "3": "g3", "4": "g4", "5": "g5", "r": "r2", "R": "r4", "x": "r1"}
TREASURE_PILE = on_floor("""
    ................
    ................
    ................
    .....5445.......
    .....4rR3.......
    ......43........
    ......53....5...
    ....545321.543..
    ...5434345434321
    ..54345345434321
    .543454345434321
    .434343434343321
    .3232323232322r1
    .2121212121211xr
    ..1111111111111.
    ..____________..
""", GOLD_KEY)

# ── 거울 웅덩이: 짙은 물에 동굴 천장의 반짝임이 비친다. 가로 물결, 청록 반짝임 ──────────
POOL_KEY = {"0": "p0", "1": "p1", "2": "p2", "3": "p3", "4": "p4", "5": "p5", "t": "i3", "T": "i4"}
CAVE_POOL = paint("""
    1111111111111111
    1112222111111111
    1122332211111111
    1111222111111111
    1111111111112221
    1111111111111111
    0001111111111111
    1111111111111111
    1111111141111111
    1111111111111110
    1111111111111111
    1121111111122111
    1233221111233321
    1112211111122211
    0111111111111111
    11T1111111111111
""", POOL_KEY, 16, 16)

# ── 광차 레일: 동굴 바닥에 가로로 놓인 쇠 레일 두 줄과 나무 침목 ──────────────────
RAIL_KEY = {"w": "w2", "W": "w3", "v": "w1", "m": "m1", "M": "m3", "N": "m4"}
RAIL = paint("""
    ................
    ................
    ................
    .WW....WW....WW.
    NNNNNNNNNNNNNNNN
    MMMMMMMMMMMMMMMM
    mwwmmmmwwmmmmwwm
    .ww....ww....ww.
    .ww....ww....ww.
    .WW....WW....WW.
    NNNNNNNNNNNNNNNN
    MMMMMMMMMMMMMMMM
    mwwmmmmwwmmmmwwm
    .vv....vv....vv.
    ................
    ................
""", RAIL_KEY, 16, 16)
MINECART_RAIL = overlay(CAVE_FLOOR, RAIL)

# ── 뼈 더미: 해골 하나와 흩어진 뼈 ──────────────────────────────────────────────
BONE_KEY = {"0": "b0", "1": "b1", "2": "b2", "3": "b3", "4": "b4", "e": "c0"}
BONE_PILE = on_floor("""
    ................
    ................
    ................
    ................
    .....3443.......
    ....344443......
    ....3ee4ee2.....
    ....3ee3ee2.....
    .....33032......
    .4...2121..4....
    .3432....3432...
    ..1.32432.1.....
    ....2.1.2..34...
    ..___...___.21..
    ..........___...
    ................
""", BONE_KEY)

CAVE_TILES = {
    "cave_floor": CAVE_FLOOR,
    "cave_wall": CAVE_WALL,
    "cave_wall_top": CAVE_WALL_TOP,
    "torch_frozen": TORCH_FROZEN,
    "crystal": CRYSTAL,
    "rubble": RUBBLE,
    "treasure_pile": TREASURE_PILE,
    "cave_pool": CAVE_POOL,
    "mural_wall": MURAL_WALL,
    "cave_crack": CAVE_CRACK,
    "minecart_rail": MINECART_RAIL,
    "bone_pile": BONE_PILE,
}
