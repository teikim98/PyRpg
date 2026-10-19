"""지역 7(모래시계 사막) 지형 타일(16×16)과 고장 난 다리 오브젝트. manifest의 overworld 타일셋 끝에 명세 순서대로 붙는다.

- 바닥류(desert_sand 모래, desert_path 흰 돌 포석, star_floor 별자리 유적의 남색 판석, altar_floor 금테 제단 판석,
  canal_bridge 모래 수로를 건너는 널다리)와 칸을 채우는 막힌 바탕(desert_dune 모래 언덕, sandstone_wall 붉은 사암 벽,
  oasis_water 오아시스 물, sand_canal 흘러내리는 모래 수로)은 가장자리가 이어지게 그린다.
  desert_dune은 가로 능선(밝은 비탈 + 짙은 그늘)이 반복되고, sand_canal은 세로로 흐르는 줄무늬라 멀리서도 구별된다.
- sandstone_gap(숨겨진 길)은 sandstone_wall과 같은 그림에 가운데 세로 틈이 하나 더 있고, 그 틈 그림자가 다른 금보다
  한 단계 짙다(지나갈 수 있음).
- 물체류는 바닥을 그림에 품는다(밑바닥을 맵 생성기가 맞춘다).
  모래 위: camel_skull(낙타 해골, 밟을 수 있음), palm_tree(야자), cactus(선인장), buried_hourglass(반쯤 묻힌 모래시계,
  목에서 떨어지다 멈춘 모래알)
  별자리 판석 위: ruin_pillar(위가 부서진 흰 돌기둥)
- obj_bridge_broken(16×16 오브젝트 2프레임): canal_bridge 위에 겹쳐 그리는 고장 난 다리. 가운데 널이 무너져 아래
  모래 수로가 보이고 부러진 널 하나가 비스듬히 걸렸다. 정지 그림이고 프레임 B는 구멍 속 모래알만 한 칸 흘러내린다
  (엔진이 정지 스프라이트로 다루지 않아도 깜빡이지 않게).
"""
from forestpal import Rng
from gridlib import overlay
from desertpal import CH, color_outline, paint, ramp_rows


def _scatter(base: int, seed: int, spots: list[tuple[int, int]], size: int = 16):
    """base 값으로 채운 숫자 그리드에 (값, 개수) 점을 결정적으로 흩뿌린다."""
    g = [[base] * size for _ in range(size)]
    rng = Rng(seed)
    for v, n in spots:
        for _ in range(n):
            g[rng.randint(0, size - 1)][rng.randint(0, size - 1)] = v
    return g


# ── 모래: 주황 모래 바탕에 밝은·어두운 알갱이, 바람이 그린 얕은 물결 세 줄(밝은 등 + 아래 그늘) ─────────────
def _sand():
    g = _scatter(4, 71, [(5, 18), (3, 16), (6, 3)])
    for x0, y, n in ((1, 4, 6), (9, 9, 6), (4, 13, 5)):
        for k in range(n):
            yy = y - (1 if 0 < k < n - 1 else 0)
            x = (x0 + k) % 16
            g[yy][x] = 5
            g[(yy + 1) % 16][x] = 3
    return ramp_rows(g, "d")


DESERT_SAND = _sand()


# ── 포석 길: 흰 석회암 판석을 엇갈려 깔고 이음매에 모래가 찼다(위·왼쪽 밝게, 아래·오른쪽 그늘, 모서리는 둥글게) ───
def _path():
    rows = [[CH["b3"]] * 16 for _ in range(16)]
    stones = [(0, 0, 8, 8), (8, 0, 8, 8), (4, 8, 8, 8), (12, 8, 8, 8)]
    for x0, y0, w, h in stones:
        for j in range(h):
            for i in range(w):
                x, y = (x0 + i) % 16, (y0 + j) % 16
                edge_r, edge_b = i == w - 1, j == h - 1
                corner = (i in (0, w - 2) and j in (0, h - 2)) and (i, j) != (0, 0)
                if edge_r or edge_b:
                    c = "d3"
                elif corner and (i, j) in ((w - 2, h - 2),):
                    c = "d4"
                elif j == 0 or i == 0:
                    c = "b4"
                elif j == h - 2 or i == w - 2:
                    c = "b2"
                else:
                    c = "b3"
                rows[y][x] = CH[c]
    for x, y in ((3, 3), (10, 5), (6, 11), (14, 13), (1, 12)):
        rows[y][x] = CH["b2"]
    return ["".join(r) for r in rows]


DESERT_PATH = _path()


# ── 모래 언덕: 칸마다 물결치는 능선 하나. 능선 위는 해를 받은 밝은 비탈, 능선 바로 아래는 짙은 그늘이
# 아래로 갈수록 옅어진다. 위아래·옆으로 이으면 능선이 겹겹이 선 모래 언덕 벽이 된다 ──────────────────
def _dune():
    crest = [6, 5, 5, 4, 4, 4, 5, 5, 6, 7, 7, 8, 8, 8, 7, 7]
    below = [1, 2, 2, 2, 3, 3, 3, 3, 4]
    g = [[4] * 16 for _ in range(16)]
    for x in range(16):
        c = crest[x]
        for y in range(16):
            d = y - c
            if d == 0:
                g[y][x] = 6
            elif d > 0:
                g[y][x] = below[d - 1] if d - 1 < len(below) else 4
            else:
                g[y][x] = 5 if d >= -2 else 4
    rng = Rng(23)
    for _ in range(10):
        x, y = rng.randint(0, 15), rng.randint(0, 15)
        if g[y][x] in (4, 5):
            g[y][x] += 1 if g[y][x] == 4 else -1
    return ramp_rows(g, "d")


DESERT_DUNE = _dune()


# ── 붉은 사암 벽: 물결치는 가로 지층 셋(위는 빛 받은 턱, 아래는 그늘), 지층 가운데 짧은 세로 금(짙은 금 + 오른쪽
# 밝은 테)과 작은 구멍. 지층 경계가 칸마다 같은 높이에서 끝나 옆·위아래로 이으면 끊김 없는 협곡 벽이 된다 ─────────
# 지층 경계(각 지층의 첫 줄) x별 높이: 가장자리(x 0, 15)는 0·5·10으로 같아 옆 칸과 이어진다
_TOPS = [
    [0] * 16,
    [5, 5, 5, 4, 4, 4, 5, 5, 6, 6, 6, 6, 5, 5, 5, 5],
    [10, 10, 11, 11, 11, 10, 10, 9, 9, 9, 10, 10, 10, 11, 11, 10],
]
_CRACKS = [((4, 1, 3), (12, 1, 2)), ((1, 6, 2), (10, 7, 2)), ((6, 12, 3), (14, 12, 2))]  # (x, 시작 y, 길이)
_GAP_CRACK = (8, 7, 2)  # 숨겨진 틈 칸에만 있는 금: 가운데 지층의 금과 같은 모양, 색만 한 단계 짙다


def _sandstone(gap: bool):
    rows = [[None] * 16 for _ in range(16)]
    for x in range(16):
        bounds = [t[x] for t in _TOPS] + [16]
        for k in range(3):
            y0, y1 = bounds[k], bounds[k + 1]
            h = y1 - y0
            for j in range(h):
                c = "r5" if j == 0 else "r2" if j == h - 1 else "r3" if j == h - 2 else "r4"
                rows[y0 + j][x] = c
    cracks = [c for layer in _CRACKS for c in layer]
    for cx, cy, n in cracks:
        for j in range(n):
            rows[cy + j][cx] = "r1"
            rows[cy + j][cx + 1] = "r5"
    for x, y in ((2, 2), (9, 3), (13, 7), (3, 13), (11, 13)):
        rows[y][x] = "r3"
    if gap:
        # 숨겨진 틈: 다른 금과 같은 길이·모양의 금 하나가 가운데에 더 있고, 그 그림자가 한 단계 짙다(r0, 옆은 r1)
        cx, cy, n = _GAP_CRACK
        for j in range(n):
            rows[cy + j][cx] = "r0"
            rows[cy + j][cx - 1] = "r2"
            rows[cy + j][cx + 1] = "r5"
    return ["".join(CH[c] for c in r) for r in rows]


SANDSTONE_WALL = _sandstone(False)
SANDSTONE_GAP = _sandstone(True)


# ── 오아시스 물: 청록 물에 둥근 물결(밝은 테 + 아래 그늘)과 반짝임 ─────────────────────────────
def _oasis():
    g = [[3] * 16 for _ in range(16)]
    for y in range(16):
        for x in range(16):
            if (x * 3 + y * 5) % 17 == 0:
                g[y][x] = 2
    ripples = [(2, 3, 5), (10, 6, 4), (5, 10, 5), (12, 13, 4)]
    for x0, y, n in ripples:
        for k in range(n):
            yy = y - (1 if 0 < k < n - 1 else 0)
            g[yy][(x0 + k) % 16] = 5 if 0 < k < n - 1 else 4
            g[(yy + 1) % 16][(x0 + k) % 16] = 2
    for x, y in ((4, 2), (12, 5), (7, 9), (14, 12)):
        g[y][x] = 6
    return ramp_rows(g, "o")


OASIS_WATER = _oasis()


# ── 별자리 판석: 밤하늘 남색 판석 넷(위·왼쪽 테가 밝고 이음매는 짙다)에 금빛·흰 별과 희미한 별자리 선 ──────────
def _star_floor():
    g = [[2] * 16 for _ in range(16)]
    for y in range(16):
        for x in range(16):
            if x % 8 == 7 or y % 8 == 7:
                g[y][x] = 1
            elif x % 8 == 0 or y % 8 == 0:
                g[y][x] = 3
    rows = ramp_rows(g, "v")
    rows = [list(r) for r in rows]
    # 별자리 선(희미한 점선)과 별
    for x, y in ((3, 3), (4, 4), (10, 10), (11, 11), (12, 12)):
        rows[y][x] = CH["v4"]
    for x, y, c in ((2, 2, "g4"), (5, 5, "b5"), (9, 9, "b5"), (13, 13, "g4"), (12, 3, "v6"), (3, 12, "v5")):
        rows[y][x] = CH[c]
    return ["".join(r) for r in rows]


STAR_FLOOR = _star_floor()


# ── 모래 수로: 가라앉은 수로(모래보다 한 단계 어두움)에 모래가 아래(남쪽)로 흘러내린다. 아래를 향한 얕은 V자 물결
# (밝은 등 + 아래 그늘)이 칸마다 둘, 반짝이는 알갱이 몇 점. 옆으로 이으면 물결이 한 줄로 이어진다 ─────────────
def _canal(phase: int = 0):
    g = [[3] * 16 for _ in range(16)]
    rng = Rng(41)
    for _ in range(26):
        g[rng.randint(0, 15)][rng.randint(0, 15)] = 2
    for y0 in (2, 10):
        for x in range(16):
            dy = (0, 0, 1, 1, 2, 2, 3, 3, 3, 3, 2, 2, 1, 1, 0, 0)[x]
            y = (y0 + dy + phase) % 16
            g[(y - 1) % 16][x] = 2
            g[y][x] = 4
            g[(y + 1) % 16][x] = 1 if x % 4 else 2
    for x, y in ((3, 6), (11, 5), (6, 14), (13, 13)):
        g[(y + phase) % 16][x] = 5
    return ramp_rows(g, "d")


SAND_CANAL = _canal()


# ── 수로 널다리: 위·아래 두 줄은 수로, 그 안쪽은 가로대(밝은 윗면 + 짙은 아랫면), 가운데는 세로로 깐 널 넷 ─────
def _canal_bridge():
    rows = [list(r) for r in SAND_CANAL]
    g = [[4] * 16 for _ in range(16)]
    for x in range(16):
        g[2][x], g[3][x] = 1, 5
        g[12][x], g[13][x] = 2, 1
        for y in range(4, 12):
            i = x % 4
            g[y][x] = (5, 4, 4, 2)[i]
            if (y * 3 + x // 4 * 5) % 7 == 0 and i == 1:
                g[y][x] = 3  # 나뭇결
    for y in range(2, 14):
        for x in range(16):
            rows[y][x] = CH[f"w{g[y][x]}"]
    # 가로대의 못
    for x in (1, 5, 9, 13):
        rows[3][x] = CH["b4"]
        rows[12][x] = CH["w3"]
    return ["".join(r) for r in rows]


CANAL_BRIDGE = _canal_bridge()


# ── 제단 판석: 크림빛 판석 넷 사이에 금 상감 줄, 판석마다 가운데 작은 금 마름모(모래시계 문양) ─────────────
def _altar():
    g = [["d5"] * 16 for _ in range(16)]
    for y in range(16):
        for x in range(16):
            if x % 8 == 7 or y % 8 == 7:
                g[y][x] = "g2"
            elif x % 8 == 0 or y % 8 == 0:
                g[y][x] = "d6"
            elif x % 8 == 6 or y % 8 == 6:
                g[y][x] = "d4"
    for cx, cy in ((3, 3), (11, 3), (3, 11), (11, 11)):
        g[cy - 1][cx] = "g3"
        g[cy][cx - 1] = "g3"
        g[cy][cx] = "g4"
        g[cy][cx + 1] = "g2"
        g[cy + 1][cx] = "g2"
    return ["".join(CH[c] for c in r) for r in g]


ALTAR_FLOOR = _altar()


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


SAND_SHADOW = ("d3", "d2")
STAR_SHADOW = ("v1", "v0")

# ── 낙타 해골: 모래 위에 옆으로 누운 긴 해골(왼쪽이 주둥이). 큰 눈구멍, 콧구멍, 이빨, 옆에 뼈 하나 ───────────
SKULL_KEY = {"5": "b5", "4": "b4", "3": "b3", "2": "b2", "1": "b1", "o": "k1", "O": "k2"}
CAMEL_SKULL = on_ground("""
    ................
    ................
    ................
    ................
    ................
    ..........3443..
    .......3344554..
    ....33444455543.
    ..3344445oO5443.
    .3o44444444o432.
    ..32223334443-..
    ...2.2.2.22-....
    ..-_-_-_____....
    ..........4321..
    ...........__...
    ................
""", SKULL_KEY, DESERT_SAND, SAND_SHADOW)

# ── 야자: 둥글게 퍼져 늘어진 잎(위 밝음), 가운데 갈색 열매, 마디진 줄기가 살짝 휘며 내려온다 ──────────────
PALM_KEY = {"6": "e6", "5": "e5", "4": "e4", "3": "e3", "2": "e2", "1": "e1", "W": "w5", "w": "w4", "v": "w3",
            "b": "w1", "B": "w2"}
PALM_TREE = on_ground("""
    ....45...54.....
    ..4556455655....
    .4552.3456.2554.
    455...345563.454
    54...3bBb.43..44
    4...34BbB..43..3
    ...3...wv....3..
    .......wv.......
    ......wWv.......
    ......wv........
    ......Wv........
    .....wWv........
    .....wWv........
    .....wWv........
    ....__wv__......
    ......____......
""", PALM_KEY, DESERT_SAND, SAND_SHADOW)

# ── 선인장: 세로 줄기 하나에 팔 둘(왼쪽은 낮게, 오른쪽은 높게), 밝은 이랑과 흰 가시 점 ─────────────────
CACTUS_KEY = {"5": "e5", "4": "e4", "3": "e3", "2": "e2", "1": "e1", "s": "b5", "f": "i4"}
CACTUS = on_ground("""
    ................
    ......454.......
    .....45432......
    .....4s432..4...
    .....45432.453..
    .....45s32.4s3..
    ..4..45432.432..
    .453.4543243s2..
    .4s3.45432332...
    .43244s4322.....
    ..33345432......
    .....4543s......
    .....45432......
    .....45432......
    ....__4432__....
    ......____......
""", CACTUS_KEY, DESERT_SAND, SAND_SHADOW)

# ── 무너진 기둥: 별자리 판석 위의 흰 돌기둥. 홈이 파인 기둥 몸(왼쪽 밝게), 위는 부서져 들쭉날쭉, 아래 받침돌 ────
PILLAR_KEY = {"5": "b5", "4": "b4", "3": "b3", "2": "b2", "1": "b1", "g": "g3"}
RUIN_PILLAR = on_ground("""
    ................
    .....4.....3....
    ....453..343....
    ....4533432.....
    ....45434321....
    ....45434321....
    ....45434321....
    ....45434321....
    ....45434321....
    ....45434321....
    ....45434321....
    ....45434321....
    ...4553333221...
    ...gggggggggg...
    ...3222222211...
    ...__________-..
""", PILLAR_KEY, STAR_FLOOR, STAR_SHADOW)

# ── 반쯤 묻힌 모래시계: 금 틀(위 가로대·양옆 기둥)과 청록 유리, 위 유리에 남은 모래, 목에서 떨어지다 공중에
# 멈춘 모래알 두 점, 아래쪽은 모래 더미에 묻혔다 ──────────────────────────────────────────
GLASS_KEY = {"G": "g4", "g": "g3", "h": "g2", "H": "g1", "c": "i4", "C": "i3", "i": "i2", "s": "d5", "S": "d4",
             "m": "d5", "M": "d4", "n": "d3", "w": "i5"}
BURIED_HOURGLASS = on_ground("""
    ................
    ..GGGGGGGGGGgg..
    ..hhhhhhhhhhhH..
    ..g.cwSSSSCi.H..
    ..g.ccSSSSCi.H..
    ..g..cSSSCi..H..
    ..g...cSCi...H..
    ..g....ci....H..
    ..g....s.....H..
    ..g...c..i...H..
    ..g..c..s.i..H..
    ..g.c......i.H..
    .mmmmmMMMMMMmm..
    mmMMMMMMnnnnnnM.
    .nnn____nn___n..
    ................
""", GLASS_KEY, DESERT_SAND, SAND_SHADOW)

DESERT_TILES = {
    "desert_sand": DESERT_SAND,
    "desert_path": DESERT_PATH,
    "desert_dune": DESERT_DUNE,
    "sandstone_wall": SANDSTONE_WALL,
    "sandstone_gap": SANDSTONE_GAP,
    "camel_skull": CAMEL_SKULL,
    "oasis_water": OASIS_WATER,
    "palm_tree": PALM_TREE,
    "cactus": CACTUS,
    "ruin_pillar": RUIN_PILLAR,
    "star_floor": STAR_FLOOR,
    "sand_canal": SAND_CANAL,
    "canal_bridge": CANAL_BRIDGE,
    "altar_floor": ALTAR_FLOOR,
    "buried_hourglass": BURIED_HOURGLASS,
}


# ── 고장 난 다리(오브젝트): canal_bridge와 같은 널다리를 다시 그리되 가운데가 무너져 들쭉날쭉한 구멍으로 아래 모래
# 수로(다리 그늘이라 한 단계 어둡게)가 보인다. 구멍 둘레는 갓 부러진 밝은 널 끝, 구멍에 부러진 널 하나가 비스듬히
# 걸렸고, 위아래 가로대도 끊겼다. 위·아래 두 줄(수로)은 투명이라 밑의 canal_bridge 타일이 그대로 보인다 ─────────
_HOLE_SPAN = {2: (6, 9), 3: (6, 10), 4: (5, 10), 5: (5, 11), 6: (4, 10), 7: (5, 10), 8: (5, 11), 9: (5, 10),
              10: (4, 10), 11: (5, 10), 12: (6, 10), 13: (6, 9)}
_HANGING = [(5, 6), (6, 7), (7, 8), (8, 9)]  # 왼쪽 널 끝에서 구멍 속으로 비스듬히 처진 부러진 널(위 밝은 면, 아래 그늘)


def _bridge_broken(phase: int):
    rows = [["."] * 16 for _ in range(16)]
    for y in range(2, 14):
        for x in range(16):
            rows[y][x] = CANAL_BRIDGE[y][x]
    for y, (l, r) in _HOLE_SPAN.items():
        for x in range(l, r + 1):
            c = "d3" if (x * 5 + y * 3 - phase * 3) % 11 == 0 else "d2"  # 구멍 아래로 흐르는 모래(알갱이가 한 칸씩 내려감)
            if y <= 3:
                c = "d0"  # 다리 밑 그늘(구멍 위쪽)
            elif y == 4 or x == l:
                c = "d1"
            rows[y][x] = CH[c]
    # 갓 부러진 널 끝(구멍 둘레 몇 군데만 밝게)
    for x, y in ((4, 6), (3, 10), (5, 12), (11, 4), (12, 8), (11, 11)):
        rows[y][x] = CH["w6"]
    # 구멍 속으로 처진 부러진 널(두께 2: 위 밝은 면, 아래 그늘)
    for x, y in _HANGING:
        rows[y][x] = CH["w5"]
        rows[y + 1][x] = CH["w3"]
        rows[y + 2][x] = CH["w1"]
    return ["".join(r) for r in rows]


DESERT_OBJECTS = {
    "obj_bridge_broken": [_bridge_broken(0), _bridge_broken(1)],
}
