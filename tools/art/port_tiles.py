"""지역 5(교역항) 지형 타일(16×16). manifest의 overworld 타일셋 끝에 이 순서대로 붙는다.

- 바닥류(port_cobble 자갈길, dock_plank 부두 널, ship_deck 갑판)와 바다(harbor_water)는 가장자리가 이어지게 그린다.
  부두 널은 세로(남북), 갑판 널은 가로(동서)로 놓여 둘이 섞여도 구별된다.
- frozen_wave는 바다 위에서 말려 오르다 유리처럼 굳은 파도. 물마루와 공중에 멈춘 물방울에 청록 서리가 꼈다.
- lighthouse_wall은 칸 전체를 채우는 등대 벽(위 반은 흰 회벽, 아래 반은 빨간 띠). 세로로 쌓으면 줄무늬 탑이 된다.
- 물체류는 바닥을 그림에 품는다(밑바닥을 맵 생성기가 맞춘다).
  자갈길 위: port_crate(화물 상자), crate_gap(옆판 하나와 뚜껑 널이 빠진 빈 상자, 지나갈 수 있음),
  rope_coil(감아 둔 밧줄 더미, 밟을 수 있음), port_stall(파란 줄무늬 차양의 생선 좌판)
  부두 널 위: barrel(쇠테 두른 통), pier_post(밧줄 감긴 계선주), fishing_net(틀에 걸어 말리는 그물)
  갑판 위: ship_rail(배 난간, 옆으로 이어 붙인다)
- 명세(region05-spec.md §6)의 crate·market_stall은 지역 1 타일과 이름이 겹쳐서 port_crate·port_stall로 붙였다.
"""
from forestpal import Rng
from gridlib import overlay
from portpal import CH, color_outline, paint, ramp_rows


# ── 자갈길: 엇갈려 놓인 둥근 돌(가로 5~6칸 × 세로 4칸), 사방으로 이어진다. 대비는 낮게 ─────────────
def _cobble():
    g = [[2] * 16 for _ in range(16)]
    bands = [(0, (0, 5, 10)), (4, (3, 8, 13)), (8, (1, 7, 12)), (12, (4, 10, 15))]
    rng = Rng(53)
    for y0, starts in bands:
        for k, x0 in enumerate(starts):
            x1 = starts[(k + 1) % 3] + (16 if k == 2 else 0)
            w = x1 - x0
            for dy in range(3):
                for dx in range(w - 1):
                    # 모서리는 둥글게(모르타르 색으로 남긴다)
                    if (dy in (0, 2)) and dx in (0, w - 2):
                        continue
                    v = 3
                    if dy == 0:
                        v = 4
                    elif dy == 2:
                        v = 2 if dx > 0 else 3
                    elif dx == 0:
                        v = 4
                    g[y0 + dy][(x0 + dx) % 16] = v
            # 돌마다 밝은 점 하나
            hx = (x0 + 1 + rng.randint(0, max(0, w - 4))) % 16
            g[y0 + 1][hx] = 5 if rng.randint(0, 2) == 0 else 4
        for x in range(16):
            g[y0 + 3][x] = 1 if g[y0 + 3][x] == 2 and rng.randint(0, 5) == 0 else 2
    return ramp_rows(g, "c")


PORT_COBBLE = _cobble()


# ── 부두 널: 세로로 놓인 널 네 장(4칸 폭, 사이 틈으로 짙은 물그늘), 널 이음매는 엇갈리고 못 자국 ─────────
def _dock():
    g = [[3] * 16 for _ in range(16)]
    joints = {0: 3, 1: 11, 2: 6, 3: 14}
    rng = Rng(77)
    for p in range(4):
        x0 = p * 4
        for y in range(16):
            g[y][x0] = 4
            g[y][x0 + 3] = 0  # 널 사이 틈(아래 물그늘)
            g[y][x0 + 2] = 2 if g[y][x0 + 2] == 3 and y % 5 == 0 else g[y][x0 + 2]
        j = joints[p]
        for x in range(x0, x0 + 3):
            g[j][x] = 1
            g[(j + 1) % 16][x] = 5 if x == x0 else 4
        # 못 자국
        g[(j + 2) % 16][x0 + 1] = 1
        g[(j - 2) % 16][x0 + 1] = 1
        # 나뭇결
        for _ in range(2):
            y = rng.randint(0, 15)
            if g[y][x0 + 1] == 3:
                g[y][x0 + 1] = 2
                if g[(y + 1) % 16][x0 + 1] == 3:
                    g[(y + 1) % 16][x0 + 1] = 2
    return ramp_rows(g, "w")


DOCK_PLANK = _dock()


# ── 갑판: 가로로 놓인 짙은 붉은 널 네 장, 이음매에 나무못 두 개 ───────────────────────────────
def _deck():
    g = [[3] * 16 for _ in range(16)]
    joints = {0: 9, 1: 2, 2: 13, 3: 6}
    for p in range(4):
        y0 = p * 4
        for x in range(16):
            g[y0][x] = 4
            g[y0 + 3][x] = 1
            if x % 7 == p % 3:
                g[y0 + 2][x] = 2
        j = joints[p]
        for y in range(y0, y0 + 3):
            g[y][j] = 1
        g[y0 + 1][(j + 2) % 16] = 5
        g[y0 + 1][(j - 2) % 16] = 2
    return ramp_rows(g, "d")


SHIP_DECK = _deck()


# ── 바다: 밝은 청록 파랑. 잔물결(밝은 선 + 아래 그늘)이 엇갈려 떠 있고 반짝임 한 점 ───────────────────
def _water():
    g = [[3] * 16 for _ in range(16)]
    for y in range(16):
        for x in range(16):
            if (x + 2 * y) % 16 in (0, 1) and y % 4 == 2:
                g[y][x] = 2
    ripples = [(1, 1, 4), (9, 3, 3), (4, 7, 4), (12, 9, 3), (0, 12, 3), (7, 13, 4)]
    for x0, y, n in ripples:
        for k in range(n):
            g[y][(x0 + k) % 16] = 4
            g[(y + 1) % 16][(x0 + k + 1) % 16] = 2
        g[y][(x0 + 1) % 16] = 5
    g[5][14] = 6
    return ramp_rows(g, "b")


HARBOR_WATER = _water()

# ── 굳은 파도: 바다 위에서 말려 오르다 멈춘 물마루. 마루 끝과 공중의 물방울에 청록 서리 ─────────────
WAVE_KEY = {"1": "b2", "2": "b3", "3": "b4", "4": "b5", "5": "b6", "i": "i3", "I": "i4", "J": "i5", "0": "b1"}
_WAVE = paint("""
    ................
    ..........J.....
    ......IJ.....I..
    ....IJ55I.......
    ...I5544I..J....
    ..I5443345I.....
    ..54432..2I.....
    .5443......I....
    .4432...........
    44322...........
    4332211.......11
    3322100111..1100
    22211....00011..
    ................
    ................
    ................
""", WAVE_KEY, 16, 16)
FROZEN_WAVE = overlay(HARBOR_WATER, _WAVE)


def on_ground(text: str, legend: dict, base, shadow: tuple = ("w1", "w0"), outline: bool = True):
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


COBBLE_SHADOW = ("c1", "c0")
DECK_SHADOW = ("d1", "d0")

# ── 화물 상자: 칸을 거의 채우는 나무 상자(위 뚜껑 널 + 앞면 가로 널 + 대각 버팀목), 옆구리에 찍힌 표식 ──────
CRATE_KEY = {"L": "w6", "l": "w5", "o": "w4", "p": "w3", "q": "w2", "z": "w1", "Z": "w0",
             "x": "k1", "X": "k0", "r": "r3", "t": "i3", "T": "i4"}
_CRATE_ROWS = [
    "................",
    ".llllllllllllll.",
    ".lLLLlLLLLlLLLo.",
    ".loooloooolooop.",
    ".pppppppppppppq.",
    ".oLLLLLLLLLLLLq.",
    ".oq.ooooooooq.q.",
    ".oooqoooooopooq.",
    ".oooopoooopoooq.",
    ".oppppqppqppppq.",
    ".oLLLLLqqLLLLLq.",
    ".oooooqooqoooozq",
    ".ooooqoooopooozq",
    ".oq.qoooooopq.zq",
    ".zzzzzzzzzzzzzzq",
    "..______________",
]
PORT_CRATE = on_ground("\n".join(_CRATE_ROWS), {**CRATE_KEY, "_": "c1"}, PORT_COBBLE, COBBLE_SHADOW)

# 빈 상자(숨겨진 길): 거의 같지만 뚜껑 널 한 장이 빠져 좁은 틈이 있고, 앞면 아래 옆판이 빠져 상자 속 어둠이
# 보인다. 그 안에서 찬 바람 반짝임(청록 한 점)이 샌다. 멀리서는 상자, 자세히 보면 지나갈 수 있는 빈 껍데기
_GAP_ROWS = list(_CRATE_ROWS)
_GAP_ROWS[2] = ".lLLLlL" + "XX" + "LlLLLo."
_GAP_ROWS[11] = ".oooo" + "XXXXXX" + "ooozq"
_GAP_ROWS[12] = ".oooo" + "XxtxxX" + "ooozq"
_GAP_ROWS[13] = ".oq.q" + "XxxTxX" + "pq.zq"
CRATE_GAP = on_ground("\n".join(_GAP_ROWS), {**CRATE_KEY, "_": "c1"}, PORT_COBBLE, COBBLE_SHADOW)

# ── 밧줄 더미: 자갈길 위에 둥글게 감아 둔 굵은 밧줄(소용돌이), 한쪽으로 풀린 끝 ─────────────────
ROPE_KEY = {"5": "p5", "4": "p4", "3": "p3", "2": "p2", "1": "p1", "0": "p0"}
ROPE_COIL = on_ground("""
    ................
    ................
    ................
    ................
    .....3344443....
    ...34422224443..
    ..3421133331243.
    ..4213422243124.
    ..421342.24312..
    ..4213422243123.
    ..34211333311243
    ...3442222244.13
    ....33444433..12
    ......____...-1.
    ................
    ................
""", {**ROPE_KEY, "_": "c1"}, PORT_COBBLE, COBBLE_SHADOW)

# ── 생선 좌판: 파란·흰 줄무늬 차양, 나무 기둥, 얼음 위에 은빛 생선과 산호빛 게 ───────────────────
STALL_KEY = {"Q": "q3", "q": "q2", "W": "a5", "w": "a3", "P": "w3", "p": "w2", "O": "w5", "o": "w4", "z": "w1",
             "F": "x4", "f": "x2", "e": "eye", "I": "i4", "i": "i3", "C": "o3", "c": "o2"}
PORT_STALL = on_ground("""
    QQWWQQWWQQWWQQWW
    QQWWQQWWQQWWQQWW
    qqwwqqwwqqwwqqww
    .Q.W.Q.W.Q.W.Q..
    .P............P.
    .P............P.
    .P.IIIIIIIIII.P.
    .POIFFFfeICcCIoP
    .POiffFFFiIccioP
    .OOOOOOOOOOOOOOO
    .oooooooooooooop
    .ozzzzzzzzzzzzop
    .oPPPPPPPPPPPPop
    .oPpPPpPPpPPpPop
    .zzzzzzzzzzzzzzp
    ..______________
""", {**STALL_KEY, "_": "c1"}, PORT_COBBLE, COBBLE_SHADOW)

# ── 통: 쇠테 두 줄 두른 나무 통(위 뚜껑 타원), 부두 널 위 ──────────────────────────────────
BARREL_KEY = {"L": "w6", "l": "w5", "o": "w4", "p": "w3", "q": "w2", "z": "w1", "k": "k3", "K": "k4", "x": "k2"}
BARREL = on_ground("""
    ................
    ................
    ....pooooop.....
    ...ollllllop....
    ...olLLLLlop....
    ...pqooooqqp....
    ..okKKKKKkkxp...
    ..olloooopqqz...
    ..olLoooopqqz...
    ..olloooopqqz...
    ..olloooopqqz...
    ..okKKKKKkkxz...
    ...polooopqz....
    ....pzzzzzz.....
    ....________....
    ................
""", BARREL_KEY, DOCK_PLANK)

# ── 계선주: 부두에 박힌 굵은 나무 기둥, 둥근 머리에 서리, 허리에 감긴 밧줄 ─────────────────────
POST_KEY = {"L": "w6", "l": "w5", "o": "w4", "p": "w3", "q": "w2", "z": "w1",
            "R": "p4", "r": "p3", "s": "p2", "I": "i4", "J": "i5"}
PIER_POST = on_ground("""
    ................
    ................
    ......IJJI......
    .....IllllI.....
    .....loooop.....
    .....pllopq.....
    .....lLoopz.....
    .....RRrrss.....
    ....RrRrrsrs....
    .....rRrssz.....
    .....lLoopz.....
    .....lLoopz.....
    .....loooqz.....
    ......pqqz......
    .....______.....
    ................
""", POST_KEY, DOCK_PLANK)

# ── 그물: 두 기둥 사이 가로대에 걸어 말리는 그물(밧줄 마름모 눈), 빨간·흰 찌, 걸린 은빛 물고기 ───────────
NET_KEY = {"P": "w5", "p": "w4", "q": "w3", "z": "w1", "R": "p4", "r": "p3", "s": "p2", "W": "a5", "C": "r3",
           "F": "x4", "f": "x2", "e": "eye", "_": "w1", "-": "p1"}
# 틀(기둥 둘과 가로대)은 색 외곽선을 두르고, 그물 눈은 외곽선 없이 얹어 사이로 부두 널이 비친다
_NET_FRAME = color_outline(paint("""
    ................
    .PPPPPPPPPPPPPP.
    .pqqqqqqqqqqqqp.
    .pq..........pq.
    .pq..........pq.
    .pq..........pq.
    .pq..........pq.
    .pq..........pq.
    .pq..........pq.
    .pq..........pq.
    .pq..........pq.
    .pq..........pq.
    .pq..........pq.
    .zq..........zq.
    ................
    ................
""", NET_KEY, 16, 16))
def _net_mesh():
    """마름모 그물 눈(흰 삼베 줄, 아래로 갈수록 처져 어둡다), 아래 끝에 빨간·흰 찌, 가운데 걸린 은빛 물고기."""
    g = [["."] * 16 for _ in range(16)]
    for y in range(3, 12):
        for x in range(3, 13):
            if (x + y) % 3 == 0 or (x - y) % 3 == 0:
                g[y][x] = "a4" if y < 6 else "a3" if y < 9 else "a2"
    for x, c in ((3, "r3"), (5, "a5"), (7, "r3"), (9, "a5"), (11, "r3")):
        g[11][x] = c
    for x, y, c in ((7, 6, "x4"), (6, 7, "x4"), (7, 7, "x4"), (8, 7, "eye"), (7, 8, "x2"), (5, 7, "x2")):
        g[y][x] = c
    for x in (2, 3, 12, 13):
        g[14][x] = "w1"
    return ["".join(CH[c] if c != "." else "." for c in row) for row in g]


FISHING_NET = overlay(overlay(DOCK_PLANK, _net_mesh()), _NET_FRAME)

# ── 배 난간: 갑판 위 굵은 가로 난간(위·아래 두 줄), 사이에 둥근 난간동자. 옆으로 이으면 끊김 없이 이어진다 ────
RAIL_KEY = {"L": "d5", "l": "d4", "o": "d3", "p": "d2", "z": "d1", "Z": "d0", "g": "g3", "G": "g4"}
SHIP_RAIL = overlay(SHIP_DECK, paint("""
    ................
    ................
    LLLLLLLLLLLLLLLL
    lllGlllllllGllll
    oooooooooooooooo
    ZZZZZZZZZZZZZZZZ
    .lo.Z.lo.Z.lo.Z.
    .lo.Z.lo.Z.lo.Z.
    .lo.Z.lo.Z.lo.Z.
    .lo.Z.lo.Z.lo.Z.
    LLLLLLLLLLLLLLLL
    oooooooooooooooo
    pppppppppppppppp
    ZZZZZZZZZZZZZZZZ
    ................
    ................
""", RAIL_KEY, 16, 16))

# ── 등대 벽: 위 반은 흰 회벽 돌(엇갈린 줄눈), 아래 반은 빨간 띠 돌. 위아래·옆으로 이어진다 ────────────
def _lighthouse():
    rows = []
    for y in range(16):
        line = []
        red = y >= 8
        yy = y % 4
        off = 4 if (y // 4) % 2 else 0
        for x in range(16):
            xx = (x + off) % 8
            if yy == 3 or xx == 7:
                c = "r1" if red else "l2"
            elif yy == 0 or xx == 0:
                c = "r4" if red else "l5"
            elif yy == 2 or xx == 6:
                c = "r2" if red else "l3"
            else:
                c = "r3" if red else "l4"
            line.append(CH[c])
        rows.append("".join(line))
    # 띠 경계에 짙은 선(빨강과 흰색 사이), 아래 끝에 짙은 선(위로 쌓인 다음 칸의 흰 회벽과 갈라지게)
    rows[7] = CH["l1"] * 16
    rows[15] = CH["r0"] * 16
    return rows


LIGHTHOUSE_WALL = _lighthouse()

PORT_TILES = {
    "port_cobble": PORT_COBBLE,
    "dock_plank": DOCK_PLANK,
    "harbor_water": HARBOR_WATER,
    "frozen_wave": FROZEN_WAVE,
    "pier_post": PIER_POST,
    "port_crate": PORT_CRATE,
    "crate_gap": CRATE_GAP,
    "barrel": BARREL,
    "rope_coil": ROPE_COIL,
    "fishing_net": FISHING_NET,
    "ship_deck": SHIP_DECK,
    "ship_rail": SHIP_RAIL,
    "port_stall": PORT_STALL,
    "lighthouse_wall": LIGHTHOUSE_WALL,
}
