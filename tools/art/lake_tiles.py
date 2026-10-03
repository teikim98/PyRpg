"""지역 6(거울 호수) 지형 타일(16×16). manifest의 overworld 타일셋 끝에 이 순서대로 붙는다.

- 바닥류(lake_shore 모래 호숫가, island_grass 섬 풀, mist_grass 안개 낀 풀, lake_bridge 다리 널)와
  물(lake_water 흐르는 호수 물, mirror_water 굳은 거울 수면)은 가장자리가 이어지게 그린다.
  lake_water는 짙은 청록에 가로 물결이 흐르고, mirror_water는 밝은 하늘색 바탕에 비스듬한 은빛 반사줄과
  거꾸로 비친 구름이 있어 멀리서도 둘이 확실히 구별된다(물결이 없다).
- lake_stepping_stone은 물 위의 납작한 징검돌(지나갈 수 있음). 지역 2 stepping_stone과 이름이 겹쳐 lake_를 붙였다.
- 물체류는 바닥을 그림에 품는다(밑바닥을 맵 생성기가 맞춘다).
  안개 풀 위: lake_reed(부들 이삭이 달린 빽빽한 갈대 벽), reed_gap(거의 같지만 가운데 줄기 사이가 살짝 벌어져
  안쪽 어둠과 안개가 비치는 빈틈, 지나갈 수 있음), pebble_cairn(조약돌 더미, 밟을 수 있음)
  섬 풀 위: willow_tree(늘어진 가지가 칸을 채우는 버드나무)
  호숫가 위: echo_rock(동심원 물결 무늬가 새겨진 메아리 바위)
  호수 물 위: lily_pad(연잎과 작은 연꽃)
  다리 널 위: bridge_rail(가운데 높이의 난간, 옆으로 이어 붙인다)
"""
from forestpal import Rng
from gridlib import overlay
from lakepal import CH, color_outline, paint, ramp_rows


def _scatter(base: int, seed: int, spots: list[tuple[int, int]], size: int = 16):
    """base 값으로 채운 숫자 그리드에 (값, 개수) 점을 결정적으로 흩뿌린다(가장자리가 이어지게 감싼다)."""
    g = [[base] * size for _ in range(size)]
    rng = Rng(seed)
    for v, n in spots:
        for _ in range(n):
            g[rng.randint(0, size - 1)][rng.randint(0, size - 1)] = v
    return g


# ── 호숫가: 고운 모래 바탕에 밝은 알갱이·어두운 알갱이, 작은 조약돌 몇 개(위 밝음, 아래 그늘) ─────────
def _shore():
    g = _scatter(3, 61, [(4, 22), (2, 16), (5, 5)])
    rows = ramp_rows(g, "t")
    for x, y, w in ((3, 3, 2), (11, 6, 3), (6, 11, 2), (13, 13, 2)):
        line = list(rows[y])
        under = list(rows[y + 1])
        for k in range(w):
            line[(x + k) % 16] = CH["s5" if k == 0 else "s4"]
            under[(x + k) % 16] = CH["s2"]
        rows[y] = "".join(line)
        rows[y + 1] = "".join(under)
    return rows


LAKE_SHORE = _shore()


# ── 호수 물(흐르는 물): 짙은 청록. 가로로 길게 흐르는 물결(밝은 선 + 아래 그늘), 깊은 곳의 어두운 띠 ─────────
def _water():
    g = [[2] * 16 for _ in range(16)]
    for y in range(16):
        for x in range(16):
            if (x + 3 * y) % 16 in (0, 1, 2) and y % 4 == 1:
                g[y][x] = 1
    streams = [(0, 2, 6), (9, 4, 5), (3, 7, 6), (11, 10, 5), (1, 13, 5), (8, 14, 4)]
    for x0, y, n in streams:
        for k in range(n):
            g[y][(x0 + k) % 16] = 3 if k in (0, n - 1) else 4
            g[(y + 1) % 16][(x0 + k + 1) % 16] = 1
        g[y][(x0 + n // 2) % 16] = 5
    return ramp_rows(g, "n")


LAKE_WATER = _water()


# ── 거울 수면(굳은 물): 밝은 하늘색. 비스듬한 은빛 반사줄 두 줄(흰 심 + 밝은 테), 거꾸로 비친 구름 한 덩이,
# 아주 옅은 짙은 반사 한 줄. 물결이 없어 매끈하다 ─────────────────────────────────────────
def _mirror():
    g = [[3] * 16 for _ in range(16)]
    for y in range(16):
        for x in range(16):
            d = (x + y) % 16
            if d == 3:
                g[y][x] = 6 if y % 6 == 1 else 5
            elif d == 4:
                g[y][x] = 4
            elif d == 11 and y % 4 != 0:
                g[y][x] = 4
            elif d == 8 and y % 3 == 0:
                g[y][x] = 2
    # 거꾸로 비친 구름(아래가 둥근 반사)
    cloud = [(9, 1, 4), (8, 2, 6), (9, 3, 4)]
    for x0, y, n in cloud:
        for k in range(n):
            if g[y][(x0 + k) % 16] == 3:
                g[y][(x0 + k) % 16] = 4 if y != 3 else 5
    return ramp_rows(g, "m")


MIRROR_WATER = _mirror()


# ── 안개 낀 풀: 회록 풀 바탕에 짧은 풀잎, 그 위를 가로로 흐르는 옅은 보랏빛 안개 띠 ─────────────────
def _mist_grass():
    g = _scatter(3, 29, [(4, 18), (2, 18), (5, 4)])
    rows = [[CH[f"f{v}"] for v in row] for row in g]
    # 풀잎(세로 2칸: 밝은 끝 + 짙은 뿌리)
    for x, y in ((2, 2), (7, 5), (12, 1), (4, 9), (10, 11), (14, 7), (1, 14), (8, 14)):
        rows[y][x] = CH["f5"]
        rows[(y + 1) % 16][x] = CH["f2"]
    # 안개 띠(가로로 이어진다)
    for y, x0, n, c in ((4, 0, 7, "u4"), (4, 9, 5, "u3"), (12, 4, 8, "u4"), (12, 13, 5, "u3"), (8, 6, 3, "u3")):
        for k in range(n):
            rows[y][(x0 + k) % 16] = CH[c]
    return ["".join(r) for r in rows]


MIST_GRASS = _mist_grass()


# ── 섬 풀: 맑은 초록 풀밭에 풀잎과 작은 흰·분홍 꽃 ─────────────────────────────────────────
def _island_grass():
    g = _scatter(3, 83, [(4, 20), (2, 16), (5, 6)])
    rows = [[CH[f"e{v}"] for v in row] for row in g]
    for x, y in ((3, 3), (11, 2), (6, 8), (14, 10), (2, 12), (9, 14)):
        rows[y][x] = CH["e5"]
        rows[(y + 1) % 16][x] = CH["e2"]
    for x, y, c in ((7, 3, "a5"), (13, 6, "p4"), (4, 11, "a5"), (12, 13, "p4")):
        rows[y][x] = CH[c]
        rows[y][(x + 1) % 16] = CH["g4"] if c == "a5" else CH["p3"]
    return ["".join(r) for r in rows]


ISLAND_GRASS = _island_grass()


# ── 다리 널: 비바람에 바랜 은회색 널 네 장이 세로로 놓였다(동서로 놓인 다리를 가로지르는 널). 널 사이 틈은
# 짙은 그늘, 엇갈린 이음매와 못 자국 ───────────────────────────────────────────────
def _bridge():
    g = [[4] * 16 for _ in range(16)]
    joints = {0: 5, 1: 12, 2: 2, 3: 9}
    for p in range(4):
        x0 = p * 4
        for y in range(16):
            g[y][x0] = 5
            g[y][x0 + 3] = 1
            if (y + p * 3) % 6 == 0:
                g[y][x0 + 2] = 3
        j = joints[p]
        for x in range(x0, x0 + 3):
            g[j][x] = 2
            g[(j + 1) % 16][x] = 6 if x == x0 else 5
        g[(j + 3) % 16][x0 + 1] = 2
        g[(j - 3) % 16][x0 + 1] = 2
    return ramp_rows(g, "w")


LAKE_BRIDGE = _bridge()


def on_ground(text: str, legend: dict, base, shadow: tuple, outline: bool = True):
    """바닥 위에 물체를 얹는다. '_'·'-'는 외곽선 없이 바닥에 직접 칠하는 그림자."""
    shadow_key = {"_": shadow[0], "-": shadow[1]}
    obj_rows, shadow_rows = [], []
    for line in [r.strip() for r in text.strip("\n").splitlines() if r.strip()]:
        obj_rows.append("".join("." if ch in shadow_key else ch for ch in line))
        shadow_rows.append("".join(ch if ch in shadow_key else "." for ch in line))
    obj = paint("\n".join(obj_rows), legend, 16, 16)
    if outline:
        obj = color_outline(obj)
    sh = paint("\n".join(shadow_rows), shadow_key, 16, 16)
    return overlay(overlay(base, sh), obj)


SHORE_SHADOW = ("t2", "t1")
MIST_SHADOW = ("f1", "f0")
GRASS_SHADOW = ("e1", "e0")
WATER_SHADOW = ("n1", "n0")
BRIDGE_SHADOW = ("w2", "w1")

# ── 갈대 벽: 안개 풀 위에 빽빽이 선 금빛 초록 갈대. 줄기 끝마다 갈색 부들 이삭, 사이사이 짙은 그늘.
# 칸을 가득 채워 옆·위아래로 이으면 벽이 된다 ──────────────────────────────────────────
_HEADS = [1, 4, 0, 3, 5, 2, 0, 4]  # 짝수 열(줄기)마다 부들 이삭이 시작하는 높이


def _reeds(gap: bool):
    """짝수 열은 줄기(위 밝음 → 아래 어두움, 이삭은 갈색 3칸), 홀수 열은 줄기 사이 그늘. 몇 군데 비스듬한 잎.
    gap이면 가운데 줄기(x 8)가 빠져 좁은 틈(짙은 안쪽 + 옅은 안개 한 점)이 된다."""
    rows = []
    for y in range(16):
        line = []
        for x in range(16):
            if x % 2 == 0:
                h = _HEADS[x // 2]
                if gap and x == 8 and y >= 3:
                    c = "u4" if y == 9 else "f0" if y > 12 else "f1"
                elif h <= y < h + 3:
                    c = ("h4", "h3", "h2")[y - h]
                elif y < h:
                    c = "r2"
                elif y == h + 3:
                    c = "r6"
                else:
                    c = "r5" if (x + y) % 7 == 0 else "r4" if y < 9 else "r3" if y < 14 else "r2"
            else:
                c = "r2" if y < 7 else "r1" if y < 13 else "r0"
                if gap and x in (7, 9) and y >= 4:
                    c = "f1" if y < 13 else "f0"
            line.append(c)
        rows.append(line)
    # 비스듬한 잎(줄기 사이를 가로지른다). 빈틈 칸에서도 같은 자리에 있어 멀리서는 똑같아 보인다
    for x, y in ((1, 8), (2, 7), (3, 6), (11, 10), (12, 9), (13, 8), (5, 12), (6, 11)):
        rows[y][x] = "r5"
    return ["".join(CH[c] for c in r) for r in rows]


LAKE_REED = _reeds(False)

# 갈대 빈틈(숨겨진 길): 거의 같지만 가운데 줄기 하나가 빠져 줄기 사이가 살짝 벌어지고, 안쪽 어둠과 옅은 안개가 비친다
REED_GAP = _reeds(True)

# ── 조약돌 더미: 안개 풀 위에 둥근 조약돌을 셋 넷 쌓은 작은 돌탑(밟을 수 있음) ─────────────────────
PEBBLE_KEY = {"6": "s6", "5": "s5", "4": "s4", "3": "s3", "2": "s2", "1": "s1", "T": "t4", "t": "t3"}
PEBBLE_CAIRN = on_ground("""
    ................
    ................
    ................
    ................
    ................
    .......54.......
    ......5643......
    ......4432......
    .....TTtt3......
    ....5tTTtt2.....
    ...56544332.....
    ...54433221.....
    ..65432.5432....
    ..44332.4321....
    ...2211_2211_...
    ....____-___....
""", PEBBLE_KEY, MIST_GRASS, MIST_SHADOW)

# ── 징검돌: 호수 물 위에 납작하고 둥근 돌 하나, 둘레에 밝은 물테 ─────────────────────────────
STONE_KEY = {"6": "s6", "5": "s5", "4": "s4", "3": "s3", "2": "s2", "1": "s1", "W": "n5", "w": "n4"}
LAKE_STEPPING_STONE = on_ground("""
    ................
    ................
    ....wwwwwwww....
    ...wW......Ww...
    ..wW.556554.Ww..
    ..w.55665544.w..
    .wW5566554443Ww.
    .w.5555444433.w.
    .w.4544443333.w.
    .w.3444333322.w.
    .wW3333322221Ww.
    ..w.32222211.w..
    ..wW.111111.Ww..
    ...wW......Ww...
    ....wwwwwwww....
    ................
""", STONE_KEY, LAKE_WATER, WATER_SHADOW, outline=False)

# ── 난간: 다리 널 위 가운데 높이의 가로 난간(위 손잡이 + 아래 가로대)과 짧은 기둥. 옆으로 이으면 끊김 없다 ────
RAIL_KEY = {"6": "w6", "5": "w5", "4": "w4", "3": "w3", "2": "w2", "1": "w1", "0": "w0", "M": "m5"}
BRIDGE_RAIL = overlay(LAKE_BRIDGE, paint("""
    ................
    ................
    ................
    6666666666666666
    5555555555555555
    3333333333333333
    0000000000000000
    .53.0..53.0..53.
    .53.0..53.0..53.
    .53.0..53.0..53.
    4444444444444444
    2222222222222222
    0000000000000000
    .1....1....1....
    ................
    ................
""", RAIL_KEY, 16, 16))

# ── 버드나무: 칸을 채우는 둥근 수관에서 가는 가지가 줄줄이 늘어진다(밝은 끝 + 짙은 사이 그늘). 아래로 줄기가 비친다 ──
WILLOW_KEY = {"6": "e6", "5": "e5", "4": "e4", "3": "e3", "2": "e2", "1": "e1", "0": "e0", "h": "h3", "H": "h4", "b": "h1"}
WILLOW_TREE = on_ground("""
    ...3455554432...
    .34556655554432.
    3455665555554442
    4554555455545432
    4543454345434532
    5432543254325432
    4.32543.54325.32
    4.3.5.3h5.3.5.3.
    5.3.4.3H4.2.4.3.
    4.2.5.bH5.2.4.2.
    3.2.4.bh4.2.3.2.
    4...3.bh3...4...
    3...2_bh2_..3...
    2..__bbhh__.2...
    ......____......
    ................
""", WILLOW_KEY, ISLAND_GRASS, GRASS_SHADOW)

# ── 연잎: 호수 물 위에 V자로 갈라진 둥근 연잎, 잎맥, 작은 분홍 연꽃 봉오리 ─────────────────────────
LILY_KEY = {"5": "e5", "4": "e4", "3": "e3", "2": "e2", "1": "e1", "P": "p4", "p": "p3", "q": "p2", "W": "p5", "y": "g4"}
LILY_PAD = on_ground("""
    ................
    ................
    ................
    ....44444.......
    ...4555544......
    ..455454443.....
    .45544.4.543....
    .4544...44433...
    .4544..WPp433...
    .44443.PypP32...
    ..44434.qpq2....
    ..3343343322....
    ...3332222__....
    ....2222__......
    ................
    ................
""", LILY_KEY, LAKE_WATER, WATER_SHADOW)

# ── 메아리 바위: 호숫가에 박힌 둥근 회보라 바위. 앞면에 동심원 물결 무늬가 새겨져 있고(옅은 보라), 서리 한 점 ──
ROCK_KEY = {"6": "s6", "5": "s5", "4": "s4", "3": "s3", "2": "s2", "1": "s1", "0": "s0", "U": "u5", "u": "u3",
            "I": "i4"}
ECHO_ROCK = on_ground("""
    ................
    ................
    ......I.........
    ....455444......
    ...45654443.....
    ..4565444433....
    ..454uuuu433....
    .4554u33u3432...
    .455u3U3u3332...
    .444u3U3u3322...
    .4443u33u3321...
    .34433uu33221...
    ..3332222211....
    ...22111100.....
    ..__________....
    ................
""", ROCK_KEY, LAKE_SHORE, SHORE_SHADOW)

LAKE_TILES = {
    "lake_shore": LAKE_SHORE,
    "lake_water": LAKE_WATER,
    "mirror_water": MIRROR_WATER,
    "lake_reed": LAKE_REED,
    "reed_gap": REED_GAP,
    "pebble_cairn": PEBBLE_CAIRN,
    "lake_stepping_stone": LAKE_STEPPING_STONE,
    "lake_bridge": LAKE_BRIDGE,
    "bridge_rail": BRIDGE_RAIL,
    "willow_tree": WILLOW_TREE,
    "lily_pad": LILY_PAD,
    "mist_grass": MIST_GRASS,
    "echo_rock": ECHO_ROCK,
    "island_grass": ISLAND_GRASS,
}
