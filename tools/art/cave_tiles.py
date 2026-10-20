"""지역 3(고블린 동굴) 지형 타일(16×16). manifest의 overworld 타일셋에서 지역 2 타일 뒤에 이 순서로 붙는다.

화풍 통일(docs/art-overhaul/style-guide.md §4.4, 기준 구현 forest_tiles.py): 코지 팔레트(cozypal)의 이름 있는 색만 쓴다.
지역 강조색은 cloth_purple(수정 보라) · teal(얼음 청록) · lamp(횃불)이고 작은 물체에만 쓴다(화면 면적 15% 이하).
- 바닥(cave_floor)은 공통 램프 soil(먼지빛 흙)의 그늘색(한 단계 어둑하게, 통합 검토 2026-10-20). 벽은 청회 돌(stone)을 한 단계씩 내려 칠해 바닥보다
  어둡고 차갑다(따뜻한 흙 바닥 ↔ 차가운 돌 벽). 맵의 2/3를 덮는 벽 윗면(cave_wall_top)은 가장 어둡다.
- ground 레이어 타일(바닥·벽 앞면·벽 윗면·횃불·벽화·바위 틈·웅덩이·레일)은 불투명이고 가장자리가 이어진다
  (무늬는 x % 16, y % 16). 바닥 무늬는 칸 가장자리에 닿지 않는다.
- deco 레이어에만 놓이는 물체(crystal, rubble, treasure_pile, bone_pile)는 배경이 투명하다(DECO_UNDER).
  바깥 외곽선은 auto_outline(재질 ol), 발치에 반투명 그림자.
- 시간이 멈춘 동굴: 횃불 불꽃은 청록 얼음 속에 갇혀 있고, 웅덩이는 거울처럼 잔잔하다(애니메이션 프레임 없음).
- 숨겨진 길(cave_crack)은 벽 앞면의 세로 틈. 멀리서는 벽과 비슷하고, 보면 틈 속 어둠과 찬 바람 빛 한 점이 보인다.
"""
from cozypal import c, noise, speckle
from monsters import Px, ellipse

T = 16

FLOOR = "soil"     # 바닥: 먼지빛 흙(공통 램프)을 한 단계 내려 어둑하게. 동굴 색 보정(채도 −20%, 푸른 틴트)을 거치면 어둑한 보랏빛 흙
FLOOR_BASE, FLOOR_DARK, FLOOR_LIGHT = f"{FLOOR}.shade", f"{FLOOR}.ol", "stone.shade"   # 바탕 · 그늘 점 · 차가운 돌 부스러기 점(흙 밝은 점은 분홍으로 튀어서)
ROCK = "stone"     # 벽: 청회 돌(공통 램프)을 한 단계 내려서


# ── 도구 ─────────────────────────────────────────────────────────────────────────
def _names(fill):
    return [[fill] * T for _ in range(T)]


def _chars(g):
    return ["".join(c(n) for n in row) for row in g]


def _set(g, x, y, name):
    """이어지는 무늬용: 좌표를 16으로 감아서 칠한다(색 이름 그리드)."""
    g[y % T][x % T] = name


def _put(g, x, y, ch):
    """문자 그리드에 칠한다(칸 밖은 무시)."""
    if 0 <= x < T and 0 <= y < T:
        g[y] = g[y][:x] + ch + g[y][x + 1:]


def _shadow(g, y, x0, x1):
    """발치 그림자: y줄의 x0..x1 중 투명한 칸을 반투명 그림자로."""
    for x in range(x0, x1 + 1):
        if 0 <= x < T and g[y][x] == ".":
            _put(g, x, y, c("shadow"))
    return g


def _under(base, top):
    """불투명 바닥 위에 물체 그리드를 얹는다('.'은 바닥이 비침)."""
    return ["".join(t if t != "." else b for b, t in zip(br, tr)) for br, tr in zip(base, top)]


# ── 바닥: 동굴 바닥(먼지빛 흙) ───────────────────────────────────────────────────
def cave_floor(seed=311):
    """흙 기본색 + 4×4 칸마다 많아야 하나(그늘 얼룩, 모래알, 작은 돌, 가는 금). 맵 대부분을 덮어서 대비를 낮게,
    spec 없이 둔다. 무늬는 칸 안쪽(1..14)에만 놓아 길게 이어져도 줄무늬가 생기지 않는다."""
    g = _names(FLOOR_BASE)
    for y in range(0, T, 4):
        for x in range(0, T, 4):
            r = noise(x, y, seed)
            ox = x + 1 + int(noise(x, y, seed + 1) * 2)
            oy = y + 1 + int(noise(x, y, seed + 2) * 2)
            if r < 0.30:                                       # 그늘 얼룩(1~2px)
                _set(g, ox, oy, FLOOR_DARK)
                if noise(x, y, seed + 4) < 0.5:
                    _set(g, ox + 1, oy, FLOOR_DARK)
            elif r < 0.45:                                     # 모래알(밝음 1px)
                _set(g, ox, oy, FLOOR_LIGHT)
            elif r < 0.55:                                     # 작은 돌(밝은 돌 1 + 기본 1, 아래 흙 그늘)
                _set(g, ox, oy, f"{ROCK}.hi")
                _set(g, ox + 1, oy, f"{ROCK}.base")
                _set(g, ox, oy + 1, FLOOR_DARK)
                _set(g, ox + 1, oy + 1, FLOOR_DARK)
            elif r < 0.62:                                     # 가는 금(그늘 대각선 2px)
                _set(g, ox, oy, FLOOR_DARK)
                _set(g, ox + 1, oy + 1, FLOOR_DARK)
    return _chars(g)


CAVE_FLOOR = cave_floor()


# ── 벽 앞면: 위 턱 + 크기가 제각각인 바위 덩이 + 밑동 그늘 ───────────────────────────
def _rock_face(seeds):
    """벽 앞면(색 이름 그리드). 덩이는 씨앗 점에서 가장 가까운 칸끼리 묶고(가로로 감싸 이어짐), 덩이마다
    위·왼쪽 가장자리는 밝게(돌 기본), 안쪽은 그늘, 이음매는 외곽선. 바닥보다 한 단계 어둡다."""
    R = ROCK
    g = _names(f"{R}.shade")
    # 위 턱(벽 윗면과 만나는 모서리): 빛 받는 가장자리 1px + 그 아래 그늘 줄
    for x in range(T):
        g[0][x] = f"{R}.hi" if noise(x, 0, 41) < 0.35 else f"{R}.base"
        g[1][x] = f"{R}.base" if noise(x, 1, 41) < 0.4 else f"{R}.shade"
        g[2][x] = f"{R}.ol"

    def label(x, y):
        best, bd = 0, 1e9
        for k, (sx, sy) in enumerate(seeds):
            dx = min(abs(x + 0.5 - sx), T - abs(x + 0.5 - sx))
            d = dx * dx * 0.8 + (y + 0.5 - sy) ** 2 * 1.4
            if d < bd:
                best, bd = k, d
        return best

    lab = {(x, y): label(x, y) for y in range(3, 14) for x in range(T)}
    for y in range(3, 14):
        for x in range(T):
            L = lab[(x, y)]
            right = lab[((x + 1) % T, y)]
            below = lab.get((x, y + 1), L)
            above = lab.get((x, y - 1), -1)
            left = lab[((x - 1) % T, y)]
            if right != L or below != L:
                g[y][x] = f"{R}.ol"                            # 덩이 사이 이음매
            elif above != L or left != L:
                g[y][x] = f"{R}.base"                          # 빛 받는 위·왼쪽 가장자리
            else:
                g[y][x] = f"{R}.shade"
    # 밑동: 아래로 갈수록 어둡게(바닥과 만나는 줄은 짙은 그늘). 그 아래 바닥 칸에는 엔진이 벽 그늘을 얹는다
    for x in range(T):
        if g[13][x] == f"{R}.shade" and noise(x, 13, 43) < 0.5:
            g[13][x] = f"{R}.ol"
        g[14][x] = f"{R}.ol"
        g[15][x] = "void" if noise(x, 15, 43) < 0.6 else f"{R}.ol"
    return g


_FACE_SEEDS = [(2.5, 5.0), (9.0, 4.5), (14.5, 7.0), (5.5, 10.5), (11.5, 11.5)]


def cave_wall():
    g = _rock_face(_FACE_SEEDS)
    out = _chars(g)
    return speckle(out, f"{ROCK}.shade", f"{ROCK}.ol", 0.05, 313)


CAVE_WALL = cave_wall()


# ── 벽 윗면: 바위 덩어리를 위에서 본 어두운 면(맵의 2/3를 덮는다) ───────────────────────
def cave_wall_top():
    """가장 어두운 면: 돌 외곽선 색 바탕에 둥근 혹(왼쪽 위 초승달만 돌 그늘색으로 빛을 받고, 오른쪽 아래 끝은
    깊은 틈). 같은 칸이 수백 번 반복되므로 혹의 크기를 제각각으로, 가로·세로로 감싸 이어지게 그린다.
    밝은 점은 두지 않는다(격자로 반복되어 보이므로)."""
    R = ROCK
    g = _names(f"{R}.ol")
    bumps = [(3.5, 3.5, 3.2), (11.5, 2.5, 2.6), (8.5, 9.0, 3.6), (1.5, 11.5, 2.4), (14.5, 11.0, 2.6),
             (5.0, 14.5, 2.0), (12.0, 15.5, 1.8)]
    for cx, cy, r in bumps:
        for y in range(-4, T + 4):
            for x in range(-4, T + 4):
                dx, dy = x + 0.5 - cx, y + 0.5 - cy
                d = (dx * dx + dy * dy) ** 0.5
                if d > r:
                    continue
                lit = -(dx * 0.6 + dy * 0.8) / r
                if d > r - 1.0 and lit > 0.35:
                    v = f"{R}.shade"                           # 빛 받는 초승달
                elif d > r - 1.0 and lit < -0.35:
                    v = "void"                                 # 오른쪽 아래 틈
                else:
                    v = f"{R}.ol"
                g[y % T][x % T] = v
    return _chars(g)


CAVE_WALL_TOP = cave_wall_top()


# ── 얼어붙은 횃불: 벽 앞면에 쇠 고리, 나무 자루, 청록 얼음에 갇힌 채 멈춘 불꽃 ──────────────
def torch_frozen():
    p = Px()
    # 나무 자루와 쇠 고리, 벽에 박힌 쇠판
    for y in range(9, 13):
        p.put(7, y, "wood.base")
        p.put(8, y, "wood.shade")
    for x in range(5, 11):
        p.put(x, 10, "stone.hi" if x < 8 else "stone.base")
    for x in range(6, 10):
        p.put(x, 11, "stone.shade")
    p.put(7, 13, "stone.base")
    p.put(8, 13, "stone.shade")
    # 얼음 껍질(청록, 위가 뾰족한 달걀꼴)과 그 안에 멈춘 불꽃
    ice = ellipse(8, 5.4, 3.7, 4.2) | {(7, 0), (8, 0)}
    p.mass(ice, "teal")
    flame = ellipse(8, 6.2, 2.0, 2.7) | {(7, 3), (8, 2)}
    p.mass(flame, "lamp")
    p.put(7, 6, "lamp.spec")                                   # 불꽃 속
    p.put(8, 7, "lamp.hi")
    p.put(7, 7, "lamp.spec")
    p.put(5, 3, "teal.spec")                                   # 얼음 반사 한 점
    obj = p.grid()
    return _under(CAVE_WALL, obj)


TORCH_FROZEN = torch_frozen()


# ── 벽화: 바랜 황토·청록 물감. 두건 쓴 형상이 바늘 멈춘 시계에 손을 뻗고 있다 ────────────
_MURAL = """
................
................
................
oooooooooooooooo
pPppppppppppPppp
phhppppppTTTpppp
hhhhpppppTpkTppp
phhpppphTpkkkTpp
hhhhhhpTpppppTpp
phhpppppTpppTppp
phpbpppppTTTpppp
hppbpppppppppppp
pppppppppppppppp
oooooooooooooooo
................
................
"""
_MURAL_LEGEND = {"o": "stone.ol", "p": "plank.shade", "P": "plank.base", "h": "sand.base", "b": "sand.shade",
                 "T": "teal.base", "k": "stone.ol"}


def mural_wall():
    """벽 앞면 위에 매끈하게 다듬은 판(바랜 회색 나무빛 회벽). 황토 물감으로 그린 두건 쓴 형상이 오른쪽의
    청록 시계(바늘이 멈춤)에 손을 뻗는다. 물감이 바래서 대비를 낮게 둔다."""
    p = Px()
    p.rows(_MURAL, _MURAL_LEGEND)
    for y in range(3, 14):                    # 판의 위 가장자리 빛과 바랜 얼룩
        for x in range(T):
            if p.get(x, y) == "plank.shade" and noise(x, y, 47) < 0.08:
                p.put(x, y, "plank.ol")
    g = ["".join(c(n) if n else "." for n in row) for row in p.g]
    return _under(CAVE_WALL_FACE_PLAIN, g)


CAVE_WALL_FACE_PLAIN = _chars(_rock_face([(3.0, 5.5), (10.5, 4.0), (14.0, 9.0), (6.0, 11.0), (12.0, 12.5)]))
MURAL_WALL = mural_wall()


# ── 바위 틈(지나갈 수 있음): 앞면 가운데가 위에서 아래로 갈라져 있다 ───────────────────────
# 행마다 틈의 왼쪽 x와 폭. 위는 가늘고 아래(바닥과 만나는 곳)는 사람이 비집고 들어갈 만큼 벌어진다
_CRACK = ((8, 1), (8, 1), (7, 2), (7, 2), (7, 2), (8, 2), (8, 2), (8, 2), (7, 2), (7, 3), (7, 3), (6, 3),
          (6, 4), (6, 4), (6, 4), (6, 4))


def cave_crack():
    """벽 앞면과 같은 바위에 세로로 지그재그 틈 하나: 틈 속은 깊은 어둠, 왼쪽 가장자리는 빛을 받아 밝고
    오른쪽은 그늘. 틈 속에 찬 바람 빛(청록 기본) 한 점, 발치에 떨어진 돌 부스러기. 벽과 같은 바탕이라 멀리서는
    잘 안 보이고, 두 횃불 사이를 자세히 보면 보인다."""
    g = _rock_face(_FACE_SEEDS)
    for y, (x0, w) in enumerate(_CRACK):
        if y < 2:                                             # 위 턱은 금만
            g[y][x0] = f"{ROCK}.ol"
            continue
        for k in range(w):
            g[y][x0 + k] = "void"
        g[y][x0 - 1] = f"{ROCK}.base"                         # 빛 받는 왼쪽 가장자리
        g[y][x0 + w] = f"{ROCK}.ol"
    g[9][8] = "teal.base"                                     # 틈 속 찬 바람 빛
    for x, y, n in ((4, 15, f"{ROCK}.base"), (11, 15, f"{ROCK}.base"), (11, 14, f"{ROCK}.shade")):
        g[y][x] = n                                           # 발치 돌 부스러기
    return speckle(_chars(g), f"{ROCK}.shade", f"{ROCK}.ol", 0.05, 313)


CAVE_CRACK = cave_crack()


# ── 거울 웅덩이: 잔잔한 짙은 물. 천장의 수정·서리 빛이 비친다(멈춘 시간, 애니메이션 없음) ──────────
def cave_pool():
    W = "water"
    g = _names(f"{W}.shade")
    # 수면에 비친 깊은 그늘(가로로 긴 짙은 띠)
    for x, y, n in ((1, 3, 5), (9, 10, 5), (12, 1, 3), (3, 13, 4)):
        for k in range(n):
            _set(g, x + k, y, f"{W}.ol")
    # 잔물결 없이 거울처럼: 짧은 밝은 결 두 줄(밝음 아래 그늘 없이 기본색)
    for x, y, n in ((4, 6, 3), (11, 13, 2)):
        for k in range(n):
            _set(g, x + k, y, f"{W}.base")
    _set(g, 13, 6, "teal.hi")                                  # 비친 서리 빛 한 점
    _set(g, 6, 11, "cloth_purple.base")                        # 비친 수정 빛(보라) 한 점
    return _chars(g)


CAVE_POOL = cave_pool()


# ── 광차 레일: 동굴 바닥에 가로로 놓인 쇠 레일 두 줄과 나무 침목 ──────────────────────────
def minecart_rail():
    g = [list(r) for r in CAVE_FLOOR]

    def put(x, y, name):
        g[y][x] = c(name)

    for x0 in (2, 10):                                         # 침목(위아래 끝은 흙에 묻힌다)
        for y in range(4, 13):
            put(x0, y, "wood.base")
            put(x0 + 1, y, "wood.base")
            put(x0 + 2, y, "wood.shade")
        put(x0, 4, "wood.hi")
        put(x0 + 1, 4, "wood.hi")
        for x in range(x0, x0 + 3):
            put(x, 13, FLOOR_DARK)
    for y in (5, 10):                                          # 레일(가로로 이어진다): 밝은 윗면 + 그늘 옆면
        for x in range(T):
            put(x, y, "stone.hi")
            put(x, y + 1, "stone.shade")
            if g[y + 2][x] == c(FLOOR_BASE):
                put(x, y + 2, FLOOR_DARK)
    for x0 in (3, 11):                                         # 레일을 잡는 못
        put(x0, 5, "stone.spec")
        put(x0, 10, "stone.spec")
    return ["".join(r) for r in g]


MINECART_RAIL = minecart_rail()


# ── 물체: 보라 수정(deco, 배경 투명) ─────────────────────────────────────────────
_CRYSTAL = """
................
.......P........
......HPB.......
......HBS.......
......HBS...T...
......HBS..HPS..
......HBS..HBS..
...P..HBS..HBS..
..HPS.HBS..HBS..
..HBS.HBSS.HBS..
..HBSHHBSS.HBSS.
..HBSHHBBS.HBBS.
...BSHBBSSHBBS..
....SSSSSSSSS...
................
................
"""
_CRYSTAL_LEGEND = {"H": "cloth_purple.hi", "B": "cloth_purple.base", "S": "cloth_purple.shade",
                   "P": "cloth_purple.spec", "T": "teal.hi"}


def crystal():
    """보라 수정 기둥 셋(가운데가 가장 크다). 기둥마다 왼쪽 면 밝음, 가운데 기본, 오른쪽 면 그늘, 끝은 강조.
    오른쪽 기둥 끝에 청록 서리."""
    p = Px()
    p.rows(_CRYSTAL, _CRYSTAL_LEGEND)
    g = p.grid(skip=("teal.hi",))
    return _shadow(g, 14, 3, 13)


CRYSTAL = crystal()


# ── 물체: 무너진 돌무더기(deco) ───────────────────────────────────────────────────
def rubble():
    """크기가 다른 돌 다섯 개가 뒤에서 앞으로 겹쳐 쌓인 더미. 돌마다 3단 음영, 앞 돌이 뒤 돌을 가린다."""
    p = Px()
    for cx, cy, rx, ry in ((8.0, 6.5, 2.8, 2.3), (12.6, 8.4, 2.0, 1.7), (4.6, 10.4, 3.4, 2.7),
                           (10.6, 11.2, 3.6, 2.6), (14.0, 12.6, 1.4, 1.2)):
        p.mass(ellipse(cx, cy, rx, ry), "stone", shade_below=int(cy + ry - 1))
    for x, y in ((4, 9), (10, 10), (7, 5)):                     # 돌 얼룩
        if p.get(x, y) == "stone.base":
            p.put(x, y, "stone.shade")
    p.put(3, 9, "stone.spec")
    for x, y in ((1, 13), (7, 14)):                             # 흩어진 부스러기
        p.put(x, y, "stone.base")
    g = p.grid()
    return _shadow(g, 14, 2, 14)


RUBBLE = rubble()


# ── 물체: 보물 더미(deco). 금화가 봉긋하게 쌓이고 붉은 보석 하나 ──────────────────────
def treasure_pile():
    p = Px()
    mound = set()
    for y in range(6, 14):
        t = (y - 5.5) / 8
        hw = 6.6 * min(1.0, (t / 0.75) ** 0.5)
        mound |= {(x, y) for x in range(T) if abs(x + 0.5 - 8) <= hw}
    p.mass(mound, "brass", shade_below=12)
    for x, y in sorted(mound):                                  # 금화 테두리(짧은 그늘 호)와 반짝이는 동전 면
        if p.get(x, y) != "brass.base":
            continue
        if (x + 2 * y) % 5 == 0:
            p.put(x, y, "brass.shade")
        elif (x * 3 + y) % 7 == 0:
            p.put(x, y, "brass.hi")
    for x, y in ((6, 7), (10, 9), (4, 11)):                     # 동전 면이 빛을 받음
        p.put(x, y, "brass.spec")
    for x, y, n in ((9, 6, "cloth_red.hi"), (10, 6, "cloth_red.base"), (9, 7, "cloth_red.base"),
                    (10, 7, "cloth_red.shade")):
        p.put(x, y, n)                                           # 붉은 보석
    for x, y in ((2, 13), (13, 13), (14, 12)):                   # 굴러 나온 금화
        p.put(x, y, "brass.hi")
    g = p.grid(skip=("sparkle",))
    _put(g, 7, 4, c("sparkle"))                                  # 반짝임 하나
    return _shadow(g, 14, 2, 14)


TREASURE_PILE = treasure_pile()


# ── 물체: 뼈 더미(deco). 해골 하나와 흩어진 뼈 ───────────────────────────────────
def bone_pile():
    p = Px()
    skull = ellipse(6.5, 7.0, 3.6, 3.2) | {(5, 10), (6, 10), (7, 10)}
    p.mass(skull, "cream", shade_below=10)
    for x, y in ((4, 7), (5, 7), (4, 8), (5, 8), (8, 7), (9, 7), (8, 8), (9, 8)):   # 눈구멍
        p.put(x, y, "cream.ol")
    p.put(6, 9, "cream.shade")                                   # 콧구멍
    for x in (5, 7):                                             # 이 사이
        p.put(x, 10, "cream.shade")
    # 뼈 두 개(가로로 누운 것, 비스듬한 것). 끝은 둥근 마디
    for x in range(9, 15):
        p.put(x, 12, "cream.hi")
        p.put(x, 13, "cream.shade")
    for x, y in ((8, 11), (8, 13), (15, 11), (15, 13)):
        p.put(x, y, "cream.base")
    for k in range(4):
        p.put(1 + k, 14 - k // 2, "cream.base")
    p.put(1, 13, "cream.hi")
    p.put(5, 12, "cream.hi")
    g = p.grid()
    return _shadow(g, 14, 3, 14)


BONE_PILE = bone_pile()


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

# 미리보기에서 투명 물체 타일 밑에 깔 바닥(게임에서는 맵의 ground 레이어가 깔린다)
DECO_UNDER = {n: "cave_floor" for n in ("crystal", "rubble", "treasure_pile", "bone_pile")}
