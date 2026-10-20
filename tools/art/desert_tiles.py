"""지역 7(모래시계 사막) 지형 타일(16×16)과 고장 난 다리 오브젝트. manifest의 overworld 타일셋 끝에 명세 순서대로 붙는다.

화풍 통일(docs/art-overhaul/style-guide.md §4.4, 기준 구현 forest_tiles.py): 코지 팔레트(cozypal)의 이름 있는 색만 쓴다.
지역 강조색은 rust(붉은 사암·주황 모래 그늘) · teal(오아시스·멈춘 시간 룬) · cloth_indigo(별자리 유적 밤하늘).
- 바닥은 공통 sand(§2.3 r07 행: 강조 램프 base 대신). 지역 1 흙길(같은 sand)과 다르게 읽히도록 바람이 그린 모래 물결
  (밝은 등 + 아래 그늘 활)과 주황 모래알(rust)로 한낮의 사막 질감을 준다.
- 바닥(desert_sand, desert_path, star_floor, altar_floor, canal_bridge)과 칸을 채우는 막힌 바탕(desert_dune,
  sandstone_wall·sandstone_gap, oasis_water, sand_canal)은 불투명하고 가장자리가 이어진다(무늬는 x % 16, y % 16).
- 맵을 덮는 덩어리(모래 언덕, 사암 벽)는 바닥보다 한 단계 어둡다(§3.4). 사암 벽은 rust 그늘을 바탕으로 한 가로 지층.
- 물체(camel_skull, palm_tree, cactus, ruin_pillar, buried_hourglass)는 맵의 deco 레이어에만 놓이므로 배경이
  투명하다(지역 2 stump처럼). 바깥 외곽선은 auto_outline(재질 ol), 발치에 반투명 그림자. 미리보기 바닥은 DECO_UNDER.
- sandstone_gap(숨겨진 길)은 sandstone_wall과 같은 그림에 가운데 지층을 세로로 가르는 틈이 하나 더 있고, 그 틈만 다른 금보다
  한 칸 길고 한 단계 짙다(void). 명세 §7 '거의 같아 보이되 자세히 보면 틈의 그림자가 살짝 짙게'.
- obj_bridge_broken(16×16 오브젝트 2프레임): canal_bridge 위에 겹쳐 그리는 고장 난 다리. 같은 널다리를 다시 그리되
  가운데 널이 무너져 아래 모래 수로(다리 그늘이라 한 단계 어둡게)가 보이고, 부러진 널 하나가 구멍 속으로 처졌다.
  위·아래 두 줄(수로)은 투명이라 밑의 canal_bridge가 그대로 보이고, 퍼즐을 풀어 오브젝트가 사라지면 같은 그림의
  온전한 다리가 드러난다. 정지 그림이고 프레임 B는 구멍 속 모래알만 흘러내린다.
"""
from cozypal import auto_outline, c, noise, speckle
from monsters import Px, ellipse
from tiles import _slabs

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


def _ripple(g, x, y, n, hi, sh, cap=None):
    """바람이 그린 모래 물결 하나: 가운데가 1px 솟은 활. 위 줄은 밝은 등, 바로 아래 줄은 그늘(바람 반대쪽)."""
    for k in range(n):
        yy = y - (1 if 0 < k < n - 1 else 0)
        _set(g, x + k, yy, hi)
        _set(g, x + k, yy + 1, sh)
    if cap:
        _set(g, x + n // 2, y - 1, cap)


# ── 바닥: 모래 ───────────────────────────────────────────────────────────────────
def desert_sand(seed=701):
    """한낮의 모래: sand 기본색 + 바람이 그린 얕은 물결 셋(밝은 등 + 아래 그늘, 길이·높이 엇갈림) + 주황 모래알(rust)
    + 그늘 점. 지역 1 흙길(조약돌·닳은 자국)과 달리 물결 결이 있어 사막으로 읽힌다. 맵을 넓게 덮어 대비는 낮게."""
    g = _grid(lambda x, y: c("sand.base"))
    g = speckle(g, "sand.base", "sand.shade", 0.035, seed)
    g = speckle(g, "sand.base", "rust.hi", 0.035, seed + 1)
    for x, y, n in ((1, 4, 6), (9, 9, 6), (3, 14, 5)):
        _ripple(g, x, y, n, c("sand.hi"), c("sand.shade"))
    # 물결 끝에 주황 그늘 1px씩(한낮의 그늘이 주황으로 비친다)
    for x, y in ((7, 5), (15, 10), (8, 15)):
        _set(g, x, y, c("rust.hi"))
    return g


DESERT_SAND = desert_sand()


# ── 바닥: 흰 포석 길 ─────────────────────────────────────────────────────────────
# 크림빛 석회암 판석을 엇갈려 깔았다(같은 글자 = 돌 한 장, '#' = 모래가 찬 줄눈)
_PATH_LAYOUT = """
aaaaaa#bbbbbbbb#
aaaaaa#bbbbbbbb#
aaaaaa#bbbbbbbb#
aaaaaa#bbbbbbbb#
aaaaaa#bbbbbbbb#
################
cc#dddddddd#eeee
cc#dddddddd#eeee
cc#dddddddd#eeee
cc#dddddddd#eeee
cc#dddddddd#eeee
cc#dddddddd#eeee
################
ffffffff#ggggggg
ffffffff#ggggggg
################
"""


def desert_path(seed=711):
    """포석 길: 크림 판석(cream, 돌마다 왼쪽·위 밝음, 오른쪽·아래 그늘, 모서리는 둥글게)과 모래가 찬 줄눈(sand 그늘),
    판석 위에 바람에 쓸려 온 모래 몇 점과 금 간 자국 하나."""
    g = _slabs(_PATH_LAYOUT, ("sand.shade", "cream.shade", "cream.base", "cream.hi"), seed, speck=0.04, round_=True)
    for x, y in ((3, 2), (12, 8), (5, 13)):                       # 판석 위에 쌓인 모래
        _set(g, x, y, c("sand.hi"))
        _set(g, x + 1, y, c("sand.base"))
    for x, y in ((8, 3), (9, 2)):                                  # 금 간 자국
        _set(g, x, y, c("cream.shade"))
    return g


DESERT_PATH = desert_path()


# ── 막힌 바탕: 모래 언덕 ─────────────────────────────────────────────────────────
# 능선 높이(x별): 길고 완만한 비대칭 물결(오른쪽으로 갈수록 천천히 내려가다 빠르게 올라옴). 0과 15가 이어진다
_CREST = (5, 4, 4, 3, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 6, 6)


def desert_dune(seed=721):
    """모래 언덕(맵을 덮는 덩어리, 바닥보다 한 단계 어둡게, style-guide §3.4·§4.4): 칸마다 완만한 능선 하나.
    능선 줄은 해를 받은 밝은 등(sand.hi, 몇 군데 강조), 그 위 1~2px만 앞 언덕의 빛 받은 비탈(sand.base)이고, 능선
    바로 밑 2px은 주황 그늘(rust.shade), 나머지 넓은 면은 그늘 비탈(sand.shade)에 모래 물결 결(sand.ol 점·짧은 선).
    그래서 모래 언덕은 길·빈터(밝은 sand.base)보다 한 단계 어둡게 읽히고, 위아래로 이으면 능선이 겹겹이 선다."""
    rows = [[None] * T for _ in range(T)]
    for x in range(T):
        cr = _CREST[x]
        for y in range(T):
            d = y - cr
            if d == 0:
                k = "sand.hi"
            elif -2 <= d < 0:
                k = "sand.base"
            elif d in (1, 2):
                k = "rust.shade"
            else:
                k = "sand.shade"
            rows[y][x] = c(k)
    g = ["".join(r) for r in rows]
    g = speckle(g, "sand.shade", "sand.ol", 0.035, seed)
    for x in (3, 4, 13):                                           # 능선의 강조 몇 점
        _set(g, x, _CREST[x], c("sand.spec"))
    for x, y, n in ((1, 11, 5), (9, 14, 4), (11, 1, 3)):           # 그늘 비탈의 물결 결(짧은 선 + 위 1px 밝음)
        for k in range(n):
            _set(g, x + k, y, c("sand.ol"))
        _set(g, x + 1, y - 1, c("sand.base"))
    return g


DESERT_DUNE = desert_dune()


# ── 막힌 바탕: 붉은 사암 벽(협곡) ────────────────────────────────────────────────
# 지층 경계(각 지층의 첫 줄) x별 높이. 가장자리(x 0, 15)는 0·5·11로 같아 옆 칸과 이어진다
_TOPS = (
    (0,) * 16,
    (5, 5, 5, 4, 4, 4, 5, 5, 6, 6, 6, 6, 5, 5, 5, 5),
    (11, 11, 11, 10, 10, 10, 10, 11, 11, 12, 12, 12, 11, 11, 11, 11),
)
# 지층 가운데의 짧은 세로 금(x, 시작 y, 길이): 금은 rust.ol, 오른쪽에 빛 받은 테(rust.base)
_CRACKS = ((4, 1, 2), (12, 1, 2), (2, 7, 2), (13, 7, 2), (6, 13, 2))
_GAP = (8, 6, 4)   # 숨겨진 틈: 가운데 지층을 위에서 아래까지 가르는 금(다른 금보다 길고 속이 void)


def _sandstone(gap):
    """붉은 사암 벽(바닥보다 한 단계 어둡게): 물결치는 가로 지층 셋. 지층마다 첫 줄은 빛 받은 턱(rust.base, 군데군데
    rust.hi), 몸은 rust.shade, 마지막 줄은 rust.ol 그늘. 지층 몸에 짧은 세로 금과 바람에 팬 작은 구멍. 지층 경계가 칸
    가장자리에서 같은 높이라 옆·위아래로 이으면 끊김 없는 협곡 벽이 된다."""
    rows = [[None] * T for _ in range(T)]
    for x in range(T):
        bounds = [t[x] for t in _TOPS] + [16]
        for k in range(3):
            y0, y1 = bounds[k], bounds[k + 1]
            h = y1 - y0
            for j in range(h):
                if j == 0:
                    col = "rust.hi" if noise(x, y0, 731) < 0.25 else "rust.base"
                elif j == h - 1:
                    col = "rust.ol"
                else:
                    col = "rust.shade"
                rows[y0 + j][x] = c(col)
    g = ["".join(r) for r in rows]
    g = speckle(g, "rust.shade", "brick.shade", 0.08, 733)
    for cx, cy, n in _CRACKS:
        for j in range(n):
            _set(g, cx, cy + j, c("rust.ol"))
            _set(g, cx + 1, cy + j, c("rust.base"))
    for x, y in ((9, 2), (5, 8), (11, 13)):                        # 바람에 팬 구멍(그늘 + 아래 밝은 턱)
        _set(g, x, y, c("rust.ol"))
        _set(g, x, y + 1, c("rust.base"))
    if gap:
        cx, cy, n = _GAP
        for j in range(n):
            _set(g, cx, cy + j, c("void"))
            _set(g, cx - 1, cy + j, c("rust.ol"))
            _set(g, cx + 1, cy + j, c("rust.base"))
        _set(g, cx, cy + n, c("rust.ol"))                          # 틈 아래로 새는 모래 한 점
        _set(g, cx - 1, cy + n, c("sand.shade"))
    return g


SANDSTONE_WALL = _sandstone(False)
SANDSTONE_GAP = _sandstone(True)


# ── 막힌 바탕: 오아시스 물 ───────────────────────────────────────────────────────
def oasis_water():
    """오아시스: 흐르는 물(water 램프, 지역 1 물과 같은 계열)의 정지 그림. 깊은 곳 얼룩, 짧은 물결(밝음 + 바로 아래 그늘),
    잔잔한 둥근 물결 테 하나, 강조 반짝임 1px. 애니메이션 프레임은 넣지 않는다(타일셋 순서 불변)."""
    base, hi, sh, sp = c("water.base"), c("water.hi"), c("water.shade"), c("water.spec")
    g = _grid(lambda x, y: base)
    for x, y in ((6, 6), (7, 6), (13, 1), (2, 11), (3, 11), (11, 14)):
        _set(g, x, y, sh)
    for x, y, n in ((1, 2, 3), (10, 4, 2), (3, 8, 3), (12, 10, 3), (6, 13, 2)):
        for k in range(n):
            _set(g, x + k, y, hi)
            _set(g, x + k, y + 1, sh)
    for x, y in ((9, 8), (10, 7), (11, 7), (12, 8)):               # 둥근 물결 테(물고기가 지나간 자리)
        _set(g, x, y, hi)
    _set(g, 10, 8, sh)
    _set(g, 11, 8, sh)
    _set(g, 5, 4, sp)
    return g


OASIS_WATER = oasis_water()


# ── 바닥: 별자리 유적 판석 ───────────────────────────────────────────────────────
_STAR_LAYOUT = """
aaaaaaa#bbbbbbb#
aaaaaaa#bbbbbbb#
aaaaaaa#bbbbbbb#
aaaaaaa#bbbbbbb#
aaaaaaa#bbbbbbb#
aaaaaaa#bbbbbbb#
aaaaaaa#bbbbbbb#
################
ccc#ddddddd#cccc
ccc#ddddddd#cccc
ccc#ddddddd#cccc
ccc#ddddddd#cccc
ccc#ddddddd#cccc
ccc#ddddddd#cccc
ccc#ddddddd#cccc
################
"""


def star_floor(seed=741):
    """별자리 유적 바닥: 밤하늘 남색 판석(cloth_indigo를 한 단계 내려 칠함, 왼쪽·위 밝은 테)과 짙은 줄눈. 판석에 새긴
    별(흰 점·노란 반짝임 2×1)과 희미한 별자리 선(밝음 점선). 반짝임은 칸에 하나."""
    # 밤하늘이라 한 단계 어둡게: 판석 몸 = shade, 빛 받은 테 = base, 그늘 테·줄눈 = ol
    g = _slabs(_STAR_LAYOUT, ("cloth_indigo.ol", "cloth_indigo.ol", "cloth_indigo.shade", "cloth_indigo.base"),
               seed, speck=0.0)
    for x, y in ((3, 3), (5, 4), (11, 10), (13, 12)):              # 별자리 선(희미한 점선)
        _set(g, x, y, c("cloth_indigo.base"))
    for x, y in ((2, 2), (6, 5), (10, 9), (14, 13)):               # 별
        _set(g, x, y, c("cloth_indigo.spec"))
    _set(g, 12, 3, c("white"))
    _set(g, 4, 11, c("sparkle"))
    _set(g, 5, 11, c("sparkle2"))
    return g


STAR_FLOOR = star_floor()


# ── 막힌 바탕: 모래 수로 ─────────────────────────────────────────────────────────
_V = (0, 0, 1, 1, 2, 2, 3, 3, 3, 3, 2, 2, 1, 1, 0, 0)   # 아래(남쪽)를 향한 얕은 V자 물결


def sand_canal(seed=751):
    """가라앉은 모래 수로(바닥보다 한 단계 어둡게): sand 그늘 바탕에 아래로 흘러내리는 V자 물결 둘(밝은 등 sand.base +
    아래 그늘 sand.ol, 가운데 끝은 주황 rust.base), 흐르는 모래알 점. 옆으로 이으면 물결이 한 줄로 이어지고,
    모래 언덕의 가로 능선과 결이 달라 멀리서도 구별된다."""
    g = _grid(lambda x, y: c("sand.shade"))
    g = speckle(g, "sand.shade", "sand.ol", 0.05, seed)
    for y0 in (2, 10):
        for x in range(T):
            y = y0 + _V[x]
            _set(g, x, y, c("sand.base"))
            _set(g, x, y + 1, c("sand.ol") if x % 4 else c("rust.shade"))
        for x in (7, 8):
            _set(g, x, y0 + 3, c("rust.base"))
    for x, y in ((3, 7), (12, 6), (6, 15), (13, 14)):              # 흘러내리는 모래알
        _set(g, x, y, c("sand.hi"))
    return g


SAND_CANAL = sand_canal()


# ── 바닥: 수로 널다리 ───────────────────────────────────────────────────────────
def _plank_rows(x, y):
    """널다리 몸(2~13행)의 색 이름. 위 가로대(2·3행), 아래 가로대(12·13행), 가운데는 세로로 깐 널 넷(폭 4)."""
    if y == 2:
        return "wood.ol"
    if y == 3:
        return "wood.hi"
    if y == 12:
        return "wood.shade"
    if y == 13:
        return "wood.ol"
    i = x % 4
    if i == 3:
        return "wood.ol"                         # 널 사이 틈
    if i == 0:
        return "wood.hi" if y == 4 else "wood.base"
    if i == 2:
        return "wood.shade" if y >= 10 else "wood.base"
    return "wood.base"


def canal_bridge(seed=761):
    """수로를 건너는 널다리(동서로 건넘): 위·아래 두 줄은 모래 수로가 비치고, 그 안쪽은 위 가로대(밝은 윗면)·아래
    가로대(그늘)와 세로로 깐 널 넷(왼쪽 밝음, 오른쪽 그늘, 사이 틈). 가로대에 못(크림), 널에 나뭇결·옹이."""
    g = [list(r) for r in SAND_CANAL]
    for y in range(2, 14):
        for x in range(T):
            g[y][x] = c(_plank_rows(x, y))
    g = ["".join(r) for r in g]
    g = speckle(g, "wood.base", "wood.shade", 0.06, seed)
    for x in (1, 5, 9, 13):                                        # 가로대 못
        _set(g, x, 3, c("cream.hi"))
        _set(g, x, 12, c("cream.shade"))
    for x, y in ((2, 7), (9, 9)):                                  # 옹이
        _set(g, x, y, c("wood.ol"))
    return g


CANAL_BRIDGE = canal_bridge()


# ── 바닥: 제단 판석 ─────────────────────────────────────────────────────────────
def altar_floor(seed=771):
    """모래시계 제단 바닥: 크림 판석 넷(왼쪽·위 밝은 테, 오른쪽·아래 그늘 테) 사이에 황동 상감 줄 1px(brass 그늘,
    교차점은 기본), 판석마다 가운데에 작은 모래시계 문양(황동 위·아래 가로대 + 청록 목 1px)."""
    out = []
    for y in range(T):
        row = ""
        for x in range(T):
            lx, ly = x % 8, y % 8
            if lx == 7 or ly == 7:
                col = "brass.base" if lx == ly else "brass.shade"
            elif lx == 0 or ly == 0:
                col = "cream.hi"
            elif lx == 6 or ly == 6:
                col = "cream.shade"
            else:
                col = "cream.base"
            row += c(col)
        out.append(row)
    g = speckle(out, "cream.base", "cream.shade", 0.04, seed)
    for ox, oy in ((0, 0), (8, 0), (0, 8), (8, 8)):                # 모래시계 문양
        for dx in (2, 3, 4):
            _set(g, ox + dx, oy + 2, c("brass.base"))
            _set(g, ox + dx, oy + 4, c("brass.shade"))
        _set(g, ox + 3, oy + 3, c("teal.base"))
    return g


ALTAR_FLOOR = altar_floor()


# ── 물체(투명 배경): 낙타 해골 ───────────────────────────────────────────────────
def camel_skull():
    """모래에 옆으로 누운 낙타 해골(왼쪽이 주둥이): 바랜 뼈(cream 밝은 쪽), 큰 눈구멍과 콧구멍(void), 이빨 줄, 옆에 뼈
    하나. 반쯤 모래에 묻혀 아래 가장자리에 모래 둔덕(sand)."""
    p = Px()
    skull = ellipse(9.5, 8.5, 5.2, 2.6) | ellipse(4.5, 9.5, 3.4, 1.7) | ellipse(12.0, 7.5, 2.6, 2.4)
    p.mass(skull, "cream", lift=1)
    for x, y in ((11, 7), (12, 7), (11, 8)):                      # 눈구멍
        p.put(x, y, "void")
    p.put(2, 9, "void")                                           # 콧구멍
    for x in range(3, 9, 2):                                      # 이빨 줄
        p.put(x, 11, "cream.shade")
    p.put(13, 6, "cream.spec")
    bone = {(x, 13) for x in range(9, 14)} | {(9, 12), (13, 12), (9, 14), (13, 14)}
    p.mass(bone, "cream", lift=1)
    for x in range(2, 15):                                        # 모래 둔덕(뼈 아래를 묻는다)
        if p.get(x, 12) is None and 4 <= x <= 8:
            p.put(x, 12, "sand.hi")
    g = p.grid()
    g = _shadow(g, 13, 2, 8)
    return _shadow(g, 15, 8, 14)


CAMEL_SKULL = camel_skull()


# ── 물체(투명 배경): 야자 ───────────────────────────────────────────────────────
def palm_tree():
    """야자: 마디진 줄기(wood, 마디마다 밝은 테)가 살짝 휘며 내려오고, 위에 사방으로 늘어진 큰 잎 다섯 장(grass·leaf,
    잎 끝이 아래로 처짐), 잎 아래에 열매 셋. 사막에서 가장 밝게 튀는 초록."""
    p = Px()
    trunk = [(7, 5), (7, 6), (7, 7), (8, 8), (8, 9), (8, 10), (8, 11), (9, 12), (9, 13)]
    for x, y in trunk:
        p.put(x, y, "wood.base")
        p.put(x + 1, y, "wood.shade")
        if y % 2 == 0:
            p.put(x, y, "wood.hi")
    p.put(10, 13, "wood.shade")
    p.put(8, 13, "wood.base")
    # 잎: 가운데에서 뻗어 끝이 처지는 잎(두께 2, 위 밝음 아래 그늘)
    fronds = [
        ((7, 3), (5, 2), (3, 2), (1, 3), (0, 5)),
        ((8, 3), (10, 2), (12, 2), (14, 3), (15, 5)),
        ((7, 4), (5, 5), (3, 6), (2, 8)),
        ((9, 4), (11, 5), (13, 6), (14, 8)),
        ((8, 2), (8, 1), (7, 0)),
    ]
    for f in fronds:
        cells = set()
        for (x0, y0), (x1, y1) in zip(f, f[1:]):
            n = max(abs(x1 - x0), abs(y1 - y0))
            for k in range(n + 1):
                x = round(x0 + (x1 - x0) * k / n)
                y = round(y0 + (y1 - y0) * k / n)
                cells |= {(x, y), (x, y + 1)}
        p.mass(cells, "grass")
    for x, y in ((3, 4), (12, 4), (5, 7), (11, 7)):              # 잎맥 그늘
        if p.get(x, y):
            p.put(x, y, "leaf.base")
    for x, y in ((1, 6), (15, 6), (2, 9), (14, 9)):              # 처진 잎 끝(짙은 잎)
        p.put(x, y, "leaf.shade")
    p.put(4, 2, "grass.spec")
    for x, y in ((7, 4), (9, 5), (8, 5)):                         # 열매
        p.put(x, y, "wood.ol" if (x, y) == (9, 5) else "wood.shade")
    g = p.grid()
    return _shadow(g, 14, 6, 12)


PALM_TREE = palm_tree()


# ── 물체(투명 배경): 선인장 ─────────────────────────────────────────────────────
def cactus():
    """선인장: 세로 줄기 하나에 팔 둘(왼쪽 낮게, 오른쪽 높게). 이끼빛 초록(moss)에 세로 이랑(그늘 줄), 흰 가시 점
    (cream.spec), 꼭대기에 작은 분홍 꽃 한 송이."""
    p = Px()
    stem = {(x, y) for x in range(6, 10) for y in range(2, 14)} - {(6, 2), (9, 2)}
    left = {(x, y) for x in (2, 3) for y in range(5, 10)} | {(4, 8), (5, 8), (4, 9), (5, 9)} - {(2, 5)}
    right = {(x, y) for x in (12, 13) for y in range(3, 8)} | {(10, 6), (11, 6), (10, 7), (11, 7)} - {(13, 3)}
    p.mass(stem | left | right, "moss")
    for y in range(4, 13):                                       # 세로 이랑
        if p.get(8, y) == "moss.base":
            p.put(8, y, "moss.shade")
    for x, y in ((6, 4), (7, 7), (9, 10), (6, 11), (2, 7), (13, 5), (8, 3)):   # 가시
        p.put(x, y, "cream.spec")
    for x, y in ((7, 1), (8, 1), (7, 0)):                    # 꽃
        p.put(x, y, "flower.hi" if (x, y) == (7, 0) else "flower.base")
    g = p.grid()
    return _shadow(g, 14, 5, 11)


CACTUS = cactus()


# ── 물체(투명 배경, 별자리 판석 위): 무너진 기둥 ─────────────────────────────────
def ruin_pillar():
    """위가 부서진 흰 돌기둥(cream): 세로 홈 둘(그늘 줄), 들쭉날쭉 깨진 윗면(밝음), 아래 받침돌(넓게), 받침에 새긴
    청록 별 하나(멈춘 시간 룬)."""
    p = Px()
    shaft = {(x, y) for x in range(5, 11) for y in range(3, 12)}
    shaft |= {(5, 2), (6, 2), (6, 1), (9, 2), (10, 2), (10, 1)}
    p.mass(shaft, "cream")
    for y in range(4, 11):                                        # 세로 홈
        p.put(7, y, "cream.shade")
        p.put(9, y, "cream.shade")
    for x, y in ((6, 1), (10, 1), (7, 3), (8, 3)):                # 깨진 윗면
        p.put(x, y, "cream.spec" if x in (6, 10) else "cream.hi")
    base = {(x, y) for x in range(3, 13) for y in range(12, 15)}
    p.mass(base, "cream", shade_below=14)
    for x in range(3, 13):
        p.put(x, 12, "cream.hi")
    p.put(8, 13, "teal.hi")
    g = p.grid()
    return _shadow(g, 15, 3, 13)


RUIN_PILLAR = ruin_pillar()


# ── 물체(투명 배경): 반쯤 묻힌 모래시계 ─────────────────────────────────────────
def buried_hourglass():
    """반쯤 모래에 묻힌 큰 모래시계: 황동 틀(위 가로대·양옆 기둥, brass), 청록 유리(teal), 위 유리에 남은 모래,
    목에서 떨어지다 공중에 멈춘 모래알 둘(멈춘 시간), 아래쪽은 모래 더미에 묻혔다."""
    p = Px()
    for x in range(2, 14):                                        # 위 가로대
        p.put(x, 1, "brass.hi")
        p.put(x, 2, "brass.shade")
    p.put(13, 1, "brass.base")
    for y in range(3, 12):                                        # 기둥
        p.put(2, y, "brass.base")
        p.put(13, y, "brass.shade")
    # 유리(위 삼각 + 아래 삼각): 가장자리 밝음
    glass = set()
    for y in range(3, 8):
        hw = 4 - (y - 3)
        glass |= {(x, y) for x in range(8 - hw - 1, 8 + hw + 1)}
    for y in range(8, 12):
        hw = y - 8
        glass |= {(x, y) for x in range(8 - hw - 1, 8 + hw + 1)}
    for x, y in glass:
        p.put(x, y, "teal.base")
    for x, y in glass:
        if (x - 1, y) not in glass:
            p.put(x, y, "teal.hi")
        elif (x + 1, y) not in glass:
            p.put(x, y, "teal.shade")
    for y in range(3, 6):                                         # 위 유리에 남은 모래
        for x in range(5 + (y - 3), 11 - (y - 3)):
            if (x, y) in glass:
                p.put(x, y, "sand.hi" if y == 3 else "sand.base")
    p.put(4, 3, "teal.spec")
    p.put(7, 8, "sand.hi")                                        # 떨어지다 멈춘 모래알
    p.put(7, 10, "sand.base")
    # 아래를 묻은 모래 더미
    mound = {(x, y) for x, y in ellipse(8, 14.5, 7.5, 3.6) if y >= 11}
    p.mass(mound, "sand")
    g = p.grid()
    _put(g, 9, 9, c("sparkle"))
    return _shadow(g, 15, 1, 14)


BURIED_HOURGLASS = buried_hourglass()


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

# 미리보기에서 투명 물체 타일 밑에 깔 바닥(게임에서는 맵의 ground 레이어가 깔린다)
DECO_UNDER = {"camel_skull": "desert_sand", "palm_tree": "desert_sand", "cactus": "desert_sand",
              "buried_hourglass": "desert_sand", "ruin_pillar": "star_floor"}


# ── 고장 난 다리(오브젝트) ────────────────────────────────────────────────────────
# 구멍(행 → 왼쪽·오른쪽 끝 x): 가운데 널 둘이 무너져 들쭉날쭉하다
_HOLE = {3: (6, 9), 4: (5, 10), 5: (5, 10), 6: (4, 11), 7: (5, 11), 8: (5, 10), 9: (4, 10), 10: (5, 11),
         11: (5, 10), 12: (6, 9)}
_HANGING = ((5, 6), (6, 7), (7, 8), (8, 9))   # 왼쪽 널 끝에서 구멍 속으로 처진 부러진 널


def _bridge_broken(phase):
    """canal_bridge와 같은 널다리의 2~13행을 다시 그리고 가운데를 무너뜨린다. 구멍 속은 다리 그늘 아래 모래 수로
    (sand.ol 바탕, 위쪽 가장자리는 void, 흘러내리는 모래알이 프레임마다 한 칸씩 내려감). 구멍 둘레 몇 군데는 갓
    부러진 밝은 널 끝(wood.spec), 처진 널은 윗면 밝음·아랫면 그늘. 위·아래 가로대도 끊겼다."""
    rows = [["."] * T for _ in range(T)]
    for y in range(2, 14):
        for x in range(T):
            rows[y][x] = CANAL_BRIDGE[y][x]
    for y, (l, r) in _HOLE.items():
        for x in range(l, r + 1):
            if y <= 4 or x == l:
                col = "void"
            elif (x * 5 + y * 3 - phase * 3) % 11 == 0:
                col = "sand.shade"
            else:
                col = "sand.ol"
            rows[y][x] = c(col)
    for x, y in ((4, 6), (3, 9), (5, 12), (11, 4), (12, 7), (11, 11)):
        rows[y][x] = c("wood.spec")
    for x, y in _HANGING:
        rows[y][x] = c("wood.hi")
        rows[y + 1][x] = c("wood.base")
        rows[y + 2][x] = c("wood.ol")
    return ["".join(r) for r in rows]


DESERT_OBJECTS = {
    "obj_bridge_broken": [_bridge_broken(0), _bridge_broken(1)],
}
