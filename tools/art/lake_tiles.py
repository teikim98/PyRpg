"""지역 6(거울 호수) 지형 타일(16×16). manifest의 overworld 타일셋에서 지역 5 타일 뒤에 이 순서로 붙는다.

화풍 통일(docs/art-overhaul/style-guide.md §3·§4.4, 기준 구현 forest_tiles.py): 코지 팔레트(cozypal)의 이름 있는 색만 쓴다.
지역 강조색은 sky(안개 하늘빛·거울 수면) · cloth_purple(연보라 안개·연꽃) · water(호수 물).
- 바닥(ground 레이어, 불투명, 가장자리가 이어짐):
  lake_shore(모래 호숫가, sand), lake_water(짙은 호수 물, water 그늘 바탕), mirror_water(굳은 거울 수면, sky),
  mist_grass(안개 낀 풀, 옅은 이끼 + 연보라 안개 줄), island_grass(섬 풀, 물가의 청록빛 풀 cloth_green),
  lake_bridge(바랜 회색 널 plank), lake_stepping_stone(호수 물 위 징검돌).
- 물체(deco 레이어에만 놓임, 배경 투명 + DECO_UNDER): lake_reed·reed_gap·pebble_cairn(안개 풀 위),
  willow_tree(섬 풀 위), lily_pad(호수 물 위), echo_rock(호숫가 위), bridge_rail(다리 널 위).
- 맵을 덮는 갈대 벽·버드나무는 바닥보다 한 단계 어둡게 칠하고, 사이로 비치는 칸은 그늘로 덮는다(§4.4).
- 흐르는 호수 물(짙은 청록, 가로 물결)과 굳은 거울 수면(밝은 하늘빛, 물결 없이 비스듬한 반짝임·거꾸로 비친 구름)은
  색과 무늬가 모두 달라 멀리서도 구별된다. 애니메이션 프레임은 넣지 않는다.
- 숨겨진 길 reed_gap: 갈대 벽과 같은 그림에서 가운데 줄기 둘이 빠져 좁은 틈으로 안쪽 안개 풀이 그늘에 묻혀 비친다.
"""
from cozypal import c, noise, speckle
from monsters import Px, ellipse

T = 16


# ── 도구 ─────────────────────────────────────────────────────────────────────────
def _grid(fn):
    return ["".join(fn(x, y) for x in range(T)) for y in range(T)]


def _set(g, x, y, ch):
    """이어지는 바닥용: 좌표를 16으로 감아서 칠한다."""
    x %= T
    y %= T
    g[y] = g[y][:x] + ch + g[y][x + 1:]


def _put(g, x, y, ch):
    """물체용: 칸 밖은 무시한다."""
    if 0 <= x < T and 0 <= y < T:
        g[y] = g[y][:x] + ch + g[y][x + 1:]


def _shadow(g, y, x0, x1, name="shadow"):
    """발치 그림자: y줄의 x0..x1 중 투명한 칸을 반투명 그림자로."""
    for x in range(x0, x1 + 1):
        if 0 <= x < T and g[y][x] == ".":
            _put(g, x, y, c(name))
    return g


def _under(base, top):
    """불투명 바닥 위에 물체 그리드를 얹는다('.'은 바닥이 비침)."""
    return ["".join(t if t != "." else b for b, t in zip(br, tr)) for br, tr in zip(base, top)]


def _tufts(g, ramp, seed, odds, base_step="base", hi_step="hi", sh_step="shade"):
    """4×4 칸마다 많아야 하나: 'ㅅ'자 송이 · 외잎 · 그늘 점(style-guide §4.1, 지역 2 숲 바닥과 같은 규칙).
    odds = (송이, 외잎, 그늘 점) 누적 확률."""
    hi, sh = c(f"{ramp}.{hi_step}"), c(f"{ramp}.{sh_step}")
    for y in range(0, T, 4):
        for x in range(0, T, 4):
            r = noise(x, y, seed)
            ox = x + int(noise(x, y, seed + 1) * 3)
            oy = y + int(noise(x, y, seed + 2) * 3)
            if r < odds[0]:
                _set(g, ox - 1, oy, hi)
                _set(g, ox + 1, oy, hi)
                _set(g, ox, oy + 1, sh)
            elif r < odds[1]:
                _set(g, ox, oy, hi)
                _set(g, ox, oy + 1, sh)
            elif r < odds[2]:
                _set(g, ox, oy, sh)
                if noise(x, y, seed + 4) < 0.5:
                    _set(g, ox + 1, oy, sh)
    return g


# ── 바닥: 모래 호숫가 ───────────────────────────────────────────────────────────
def lake_shore(seed=601):
    """고운 모래(sand): 닳은 자국(그늘)·모래알(밝음) 점, 회청 조약돌 둘, 연보라 조약돌 하나.
    ground 분류라 무늬(조약돌)는 칸 가장자리에 닿지 않게 둔다(§4.4)."""
    g = _grid(lambda x, y: c("sand.base"))
    g = speckle(g, "sand.base", "sand.shade", 0.05, seed)
    g = speckle(g, "sand.base", "sand.hi", 0.035, seed + 1)
    for x, y in ((3, 4), (10, 10)):                      # 회청 조약돌(밝음 2 + 그늘 2)
        _set(g, x, y, c("stone.hi"))
        _set(g, x + 1, y, c("stone.base"))
        _set(g, x, y + 1, c("stone.shade"))
        _set(g, x + 1, y + 1, c("sand.shade"))
    _set(g, 12, 3, c("cloth_purple.hi"))                 # 연보라 조약돌(작게)
    _set(g, 6, 12, c("sand.spec"))                       # 젖은 모래에 비친 빛 한 점
    return g


LAKE_SHORE = lake_shore()


# ── 바닥: 호수 물(흐르는 물) ───────────────────────────────────────────────────────
WATER_RIPPLES = ((1, 2, 4), (9, 4, 3), (4, 8, 3), (12, 10, 4), (6, 13, 3), (14, 6, 2))


def lake_water():
    """깊은 호수: 물 램프의 그늘을 바탕으로(마을 연못보다 한 단계 짙게, 경계 장식 분류 water_dark),
    가로 물결(기본 2~4px, 머리 1px 밝음, 바로 아래 깊은 그늘), 깊은 곳의 짙은 얼룩, 반짝임 1px."""
    g = _grid(lambda x, y: c("water.shade"))
    for x, y, n in ((10, 0, 3), (2, 11, 2), (13, 14, 2)):          # 깊은 얼룩
        for k in range(n):
            _set(g, x + k, y, c("water.ol"))
    for x, y, n in WATER_RIPPLES:                                  # 물결
        for k in range(n):
            _set(g, x + k, y, c("water.base"))
            _set(g, x + k + 1, y + 1, c("water.ol"))
        _set(g, x, y, c("water.hi"))
    _set(g, 7, 5, c("water.spec"))                                 # 반짝임 하나
    return g


LAKE_WATER = lake_water()


# ── 바닥: 거울 수면(굳은 물) ─────────────────────────────────────────────────────────
def mirror_water():
    """시간이 멈춰 거울처럼 굳은 수면: 밝은 하늘빛(sky) 바탕에 물결이 없다. 거꾸로 비친 구름(위가 평평하고 아래가
    둥근 흰 덩이), 비스듬한 은빛 반짝임 두 줄(흰 심 + 강조), 노을처럼 비친 연보라 한 점, 멀리 비친 버드나무 그늘 줄.
    흐르는 호수 물(짙은 청록 + 가로 물결)과 바탕 명도·무늬가 모두 다르고, 지역 2 얼어붙은 개울(굳은 물결 활)과도 다르다."""
    g = _grid(lambda x, y: c("sky.base"))
    # 거꾸로 비친 구름: 위 줄이 길고 평평, 아래로 둥근 혹 두 개. 넓은 수면에 수백 번 반복되므로 밝음 위주로 낮게
    for y, x0, n, col in ((2, 8, 6, "sky.hi"), (3, 7, 7, "sky.hi"), (4, 8, 2, "sky.hi"), (4, 11, 2, "sky.hi")):
        for k in range(n):
            _set(g, x0 + k, y, c(col))
    for x in (9, 10, 11):
        _set(g, x, 3, c("sky.spec"))
    _set(g, 13, 2, c("cloth_purple.spec"))                       # 구름 끝에 비친 연보라
    # 비스듬한 은빛 반짝임 하나(왼쪽 아래 → 오른쪽 위, 흰 심)
    for i, (x, y) in enumerate(((2, 11), (3, 10), (4, 9))):
        _set(g, x, y, c("white") if i == 1 else c("sky.spec"))
        _set(g, x, y + 1, c("sky.hi"))
    # 멀리 비친 버드나무 그늘(옅은 그늘 줄 둘)
    for x, y, n in ((10, 9, 3), (1, 15, 2)):
        for k in range(n):
            _set(g, x + k, y, c("sky.shade"))
    return g


MIRROR_WATER = mirror_water()


# ── 바닥: 안개 낀 풀 ───────────────────────────────────────────────────────────
MIST = "moss"          # 안개에 바랜 옅은 이끼: 이끼 램프를 한 단계 밝혀(밝음을 바탕으로) 쓴다


def mist_grass(seed=611):
    """안개 낀 풀밭: 이끼 램프의 밝음(moss.hi)을 바탕으로 한 옅은 풀(안개에 바래 지역 2 숲 바닥보다 한참 밝다).
    송이·외잎·그늘 점은 한 단계씩 위(강조·기본)로, 그 위를 가로로 흐르는 짧은 안개 줄(연보라 cloth_purple.spec,
    하늘빛 sky.spec). 안개 줄은 3~4px로 짧게 끊어 이어 붙여도 긴 가로줄이 되지 않게 한다."""
    g = _grid(lambda x, y: c(f"{MIST}.hi"))
    g = _tufts(g, MIST, seed, (0.22, 0.36, 0.62), hi_step="spec", sh_step="base")
    for x, y, n, col in ((1, 5, 4, "cloth_purple.spec"), (9, 12, 3, "cloth_purple.spec"), (11, 1, 3, "sky.spec")):
        for k in range(n):
            _set(g, x + k, y, c(col))
    return g


MIST_GRASS = mist_grass()


# ── 바닥: 섬 풀 ────────────────────────────────────────────────────────────────
ISLAND = "cloth_green"   # 물가의 청록빛 풀(지역 1 풀의 노란 연두·지역 2 이끼의 회록과 다른 색상)


def island_grass(seed=621):
    """버드나무 둑과 호수 한가운데 섬의 풀밭: 청록빛 풀(cloth_green) 바탕에 송이·외잎·그늘 점(spec 없이),
    작은 연보라 꽃 한 송이(2px)와 흰 꽃 한 점. 맵의 큰 면적을 덮어 꽃은 칸마다 하나 반."""
    g = _grid(lambda x, y: c(f"{ISLAND}.base"))
    g = _tufts(g, ISLAND, seed, (0.24, 0.38, 0.62))
    _set(g, 11, 6, c("cloth_purple.spec"))
    _set(g, 11, 7, c("cloth_purple.base"))
    _set(g, 3, 12, c("cream.spec"))
    return g


ISLAND_GRASS = island_grass()


# ── 바닥: 다리 널 ──────────────────────────────────────────────────────────────
def lake_bridge(seed=631):
    """비바람에 바랜 회색 널(plank) 네 장이 세로로 놓였다(동서로 놓인 다리를 가로지르는 널). 널마다 왼쪽 가장자리
    밝음, 사이 틈은 외곽선 색, 엇갈린 이음매(외곽선 + 아래 밝음)와 못 두 개(크림), 결(그늘 점)."""
    g = _grid(lambda x, y: c("plank.base"))
    g = speckle(g, "plank.base", "plank.shade", 0.07, seed)
    joints = (5, 12, 2, 9)
    for p in range(4):
        x0 = p * 4
        for y in range(T):
            _set(g, x0, y, c("plank.hi"))
            _set(g, x0 + 3, y, c("plank.ol"))
        j = joints[p]
        for x in range(x0, x0 + 3):
            _set(g, x, j, c("plank.ol"))
            _set(g, x, j + 1, c("plank.hi") if x == x0 else c("plank.base"))
        _set(g, x0 + 1, j + 2, c("cream.hi"))                      # 못
        _set(g, x0 + 1, j - 1, c("cream.shade"))
    return g


LAKE_BRIDGE = lake_bridge()


# ── 바닥: 징검돌(호수 물 위) ─────────────────────────────────────────────────────
def lake_stepping_stone():
    """호수 물 위의 납작하고 둥근 징검돌(stone): 위에 이끼 한 줌, 둘레에 밝은 물테(돌을 감싼 잔물결)와 물에 비친 그늘."""
    p = Px()
    rock = ellipse(8, 8.2, 5.6, 4.2)
    p.mass(rock, "stone", shade_below=10)
    for x, y in ((6, 5), (7, 5), (8, 5), (5, 6), (6, 6)):            # 이끼 한 줌
        p.put(x, y, "moss.base")
    p.put(7, 5, "moss.hi")
    p.put(6, 6, "moss.shade")
    p.put(10, 9, "stone.shade")
    p.put(9, 6, "stone.spec")
    g = p.grid()
    base = list(LAKE_WATER)
    ring = ellipse(8, 8.4, 7.6, 6.4) - ellipse(8, 8.4, 6.6, 5.4)    # 돌을 감싼 물테(군데군데 끊김)
    for x, y in sorted(ring):
        if noise(x, y, 641) < 0.7:
            _put(base, x, y, c("water.hi") if y < 8 else c("water.base"))
    for x in range(4, 13):                                           # 물에 비친 돌 그늘
        _put(base, x, 13, c("water.ol"))
    return _under(base, g)


LAKE_STEPPING_STONE = lake_stepping_stone()


# ── 물체: 갈대 벽 / 갈대 빈틈 ───────────────────────────────────────────────────
# 앞 줄기(x, 꼭대기 y, 부들 이삭 여부). 키·이삭 자리를 들쭉날쭉하게 해서 이어 붙여도 격자로 읽히지 않게 한다
_FRONT = ((1, 3, True), (3, 1, False), (5, 4, True), (7, 2, False), (8, 0, True), (10, 3, False),
          (12, 1, True), (14, 4, False))
# 비스듬한 잎(시작 x, 시작 y, 방향)
_BLADES = ((2, 9, 1), (11, 7, -1), (6, 12, 1), (13, 11, 1))
GAP_COLS = (7, 8)       # reed_gap에서 빠지는 가운데 두 줄기


def _reeds(gap):
    """안개 풀 위에 빽빽이 선 갈대 벽. 바닥(옅은 이끼)보다 한 단계 어둡게(§4.4):
    뒤 줄기 덩어리는 짙은 잎 외곽선·그늘 세로 결(5행부터 칸 끝까지 채워 위·아래 칸과 이어짐), 앞 줄기는 짙은 잎
    기본(빛 받는 왼쪽)·그늘, 끝은 밝음, 부들 이삭은 나무 램프 3px. 위쪽에 남은 빈칸은 옅은 그늘로 덮는다.
    gap이면 가운데 두 줄기와 그 뒤 덩어리가 빠지고, 그 자리에 외곽선 한 줄과 옅은 그늘 1px 틈(안쪽 안개 풀이 비침)이
    생긴다. 멀리서는 갈대와 같고 자세히 보면 줄기 사이가 갈라져 있다."""
    p = Px()
    for x in range(T):                                    # 뒤 줄기 덩어리(위 칸 갈대와 거의 이어지게 키가 크다)
        top = 1 + int(noise(x, 0, 651) * 4)
        if gap and x in GAP_COLS:
            continue
        for y in range(top, T):
            p.put(x, y, "leaf.ol" if (x + y // 5) % 2 else "leaf.shade")
        p.put(x, top, "leaf.base")
    for x, top, head in _FRONT:                           # 앞 줄기
        if gap and x in GAP_COLS:
            continue
        lit = x % 4 in (0, 1)
        for y in range(top, T):
            p.put(x, y, "leaf.base" if lit or y < top + 3 else "leaf.shade")
        p.put(x, top, "leaf.hi")
        if head:                                          # 부들 이삭(줄기 끝 조금 아래)
            hy = top + 1
            p.put(x, hy, "wood.hi")
            p.put(x, hy + 1, "wood.base")
            p.put(x, hy + 2, "wood.shade")
    for x0, y0, d in _BLADES:                             # 비스듬한 잎
        for k in range(3):
            x = x0 + d * k
            if gap and x in GAP_COLS:
                continue
            p.put(x, y0 - k, "leaf.hi" if k == 2 else "leaf.base")
    p.put(4, 9, "sky.hi")                                 # 잎 끝에 맺힌 이슬 하나
    g = p.grid()
    sh, soft = c("shadow"), c("shadow_soft")
    out = []
    for y, row in enumerate(g):
        line = []
        for x, ch in enumerate(row):
            if gap and x == GAP_COLS[1] and y >= 5:
                line.append(soft)                         # 틈 1px: 외곽선을 걷어 내 안쪽 안개 풀이 옅은 그늘 속에 비친다
            elif ch != ".":
                line.append(ch)
            else:
                line.append(soft if y < 11 else sh)
        out.append("".join(line))
    return out


LAKE_REED = _reeds(False)
REED_GAP = _reeds(True)


# ── 물체: 조약돌 더미 ───────────────────────────────────────────────────────────
def pebble_cairn():
    """안개 풀 위에 둥근 조약돌 셋을 쌓은 작은 돌탑(밟을 수 있음, 숨겨진 길 표지). 아래 돌이 가장 넓고 위로 갈수록
    작다. 돌마다 따로 3단 음영(왼쪽 위 밝음), 맨 위 돌에 이끼 한 점, 발치 그림자."""
    p = Px()
    for cx, cy, rx, ry in ((8, 12.0, 5.2, 2.8), (7.6, 8.3, 3.6, 2.2), (8.2, 5.2, 2.3, 1.7)):
        p.mass(ellipse(cx, cy, rx, ry), "stone", shade_below=int(cy + ry * 0.4))
    p.put(5, 11, "stone.spec")
    p.put(6, 7, "stone.spec")
    p.put(8, 4, "moss.hi")
    p.put(9, 4, "moss.base")
    p.put(11, 12, "stone.shade")
    g = p.grid()
    return _shadow(g, 15, 3, 13)


PEBBLE_CAIRN = pebble_cairn()


# ── 물체: 버드나무 ─────────────────────────────────────────────────────────────
# 늘어진 가지(x, 끝 y, 밝은 가지 여부). 길이를 들쭉날쭉하게, 가운데는 짧아 줄기가 비친다
_STRANDS = ((0, 12, True), (1, 14, False), (2, 13, True), (3, 15, False), (4, 11, True), (5, 13, False),
            (6, 10, True), (9, 11, False), (10, 12, True), (11, 14, False), (12, 15, True), (13, 13, False),
            (14, 15, True), (15, 12, False))


def willow_tree():
    """칸을 채우는 버드나무: 둥근 수관 두 덩이(왼쪽이 높고 오른쪽이 낮은 비대칭)에서 가는 가지가 줄줄이 늘어지고,
    가운데 가지 사이로 줄기가 비친다. 섬 풀보다 한 단계 어둡게(이끼 램프를 한 단계씩 내림, §4.4), 가지 끝만 밝다.
    남은 빈칸은 나무 그늘(위 옅게, 밑동 쪽 진하게)로 덮는다."""
    p = Px()
    for y in range(11, 16):                               # 줄기(그늘 속이라 두 단계, 밑동만 가지 사이로 비친다)
        p.put(7, y, "wood.shade")
        p.put(8, y, "wood.ol")
    p.put(6, 15, "wood.shade")
    p.put(9, 15, "wood.ol")
    crown = ellipse(6.0, 3.6, 6.2, 3.9) | ellipse(11.0, 5.0, 5.4, 3.6)
    p.mass(crown, "moss")
    down = {"moss.hi": "moss.base", "moss.base": "moss.shade", "moss.shade": "moss.ol"}
    for x, y in crown:
        k = down[p.get(x, y)]
        if k == "moss.shade" and y >= 6:
            k = "moss.ol"
        p.put(x, y, k)
    for x, end, lit in _STRANDS:                          # 늘어진 가지
        start = max(y for xx, y in crown if xx == x) + 1 if any(xx == x for xx, _ in crown) else 6
        for y in range(start - 2, end + 1):
            p.put(x, y, "moss.base" if lit else "moss.shade")
        p.put(x, end, "moss.hi" if lit else "moss.base")
    for x, y in ((3, 1), (4, 0), (9, 2)):                 # 꼭대기 잎 송이
        p.put(x, y, "moss.hi")
    p.put(5, 1, "moss.spec")
    g = p.grid()
    sh, soft = c("shadow"), c("shadow_soft")
    return ["".join((sh if y >= 11 else soft) if ch == "." else ch for ch in row) for y, row in enumerate(g)]


WILLOW_TREE = willow_tree()


# ── 물체: 연잎 ───────────────────────────────────────────────────────────────
def lily_pad():
    """호수 물 위의 둥근 연잎(이끼 램프, V자로 갈라진 틈과 잎맥)과 작은 연보라 연꽃(가운데 노란 꽃술), 둘레 잔물결."""
    p = Px()
    cx, cy = 7.5, 9.5
    pad = ellipse(cx, cy, 5.6, 3.6)
    notch = {(x, y) for x, y in pad if x + 0.5 > cx and abs(y + 0.5 - cy) < (x + 0.5 - cx) * 0.4 + 0.2}
    pad -= notch                                           # 가운데에서 오른쪽으로 V자로 갈라진 틈
    p.mass(pad, "moss", shade_below=11)
    for x, y in ((5, 9), (4, 9), (6, 8), (5, 11)):         # 잎맥(가운데에서 퍼짐)
        p.put(x, y, "moss.shade")
    # 잎 위에 핀 작은 연꽃(왼쪽 위): 꽃잎 연보라, 가운데 노란 꽃술
    for x, y, col in ((5, 5, "cloth_purple.spec"), (4, 6, "cloth_purple.hi"), (6, 6, "cloth_purple.base"),
                      (5, 6, "lamp.hi"), (4, 7, "cloth_purple.base"), (5, 7, "cloth_purple.shade"),
                      (6, 7, "cloth_purple.shade")):
        p.put(x, y, col)
    g = p.grid()
    for x, y in ((1, 13), (2, 14), (13, 13), (12, 14), (14, 6)):    # 잔물결
        if g[y][x] == ".":
            _put(g, x, y, c("water.base"))
    return _shadow(g, 14, 4, 11, "shadow_soft")


LILY_PAD = lily_pad()


# ── 물체: 메아리 바위 ───────────────────────────────────────────────────────────
def echo_rock():
    """호숫가에 박힌 둥근 바위(stone): 앞면에 동심원 물결 무늬가 새겨져 있다(바깥 고리 연보라, 안쪽 하늘빛, 가운데 점).
    꼭대기에 이끼, 발치 그림자."""
    p = Px()
    rock = ellipse(7.8, 8.6, 6.4, 5.4)
    p.mass(rock, "stone", shade_below=12)
    for x, y in ellipse(7.6, 9.0, 3.6, 2.9) - ellipse(7.6, 9.0, 2.5, 1.9):   # 새긴 고리
        p.put(x, y, "cloth_purple.hi" if x + y < 17 else "cloth_purple.base")
    for x, y in ellipse(7.6, 9.0, 1.4, 1.0):
        p.put(x, y, "sky.hi")
    p.put(7, 9, "white")
    for x, y in ((4, 4), (5, 4), (6, 3), (7, 3), (5, 3)):   # 이끼
        p.put(x, y, "moss.base")
    p.put(5, 3, "moss.hi")
    p.put(11, 5, "stone.spec")
    g = p.grid()
    return _shadow(g, 14, 2, 13)


ECHO_ROCK = echo_rock()


# ── 물체: 다리 난간 ────────────────────────────────────────────────────────────
def bridge_rail():
    """다리 널 위 가운데 높이의 가로 난간(나무): 위 손잡이(3px, 위 밝음) + 아래 가로대(2px), 8px마다 기둥.
    옆으로 이어 붙이면 끊김 없다(무늬가 8칸 주기). 아래에 널 위로 떨어진 그늘."""
    p = Px()
    for x in range(T):
        p.put(x, 3, "wood.hi")
        p.put(x, 4, "wood.base")
        p.put(x, 5, "wood.shade")
        p.put(x, 9, "wood.base")
        p.put(x, 10, "wood.shade")
    for x0 in (2, 10):                                    # 기둥
        for y in range(3, 13):
            p.put(x0, y, "wood.hi" if y > 5 else p.get(x0, y))
            p.put(x0 + 1, y, "wood.shade" if y > 5 else p.get(x0 + 1, y))
        p.put(x0, 2, "wood.hi")
        p.put(x0 + 1, 2, "wood.base")
        p.put(x0 + 1, 7, "wood.ol")                       # 못 자국
    p.put(6, 3, "wood.spec")
    p.put(14, 3, "wood.spec")
    g = p.grid()
    for y in (12, 13):
        g = _shadow(g, y, 0, 15, "shadow_soft")
    return g


BRIDGE_RAIL = bridge_rail()


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

# 미리보기에서 투명 물체 타일 밑에 깔 바닥(게임에서는 맵의 ground 레이어가 깔린다. 맵에서 실제로 놓인 바닥)
DECO_UNDER = {
    "lake_reed": "mist_grass", "reed_gap": "mist_grass", "pebble_cairn": "mist_grass",
    "willow_tree": "island_grass", "lily_pad": "lake_water", "echo_rock": "lake_shore", "bridge_rail": "lake_bridge",
}

