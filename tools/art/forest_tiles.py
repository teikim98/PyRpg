"""지역 2(갈림길 숲) 지형 타일(16×16). manifest의 overworld 타일셋에서 지역 1 타일 24종 바로 뒤에 이 순서로 붙는다.

화풍 통일(docs/art-overhaul/style-guide.md, 지역 1 tiles.py가 기준 구현): 코지 팔레트(cozypal)의 이름 있는 색만 쓴다.
지역 강조색은 moss(이끼) · leaf(짙은 잎) · brick(버섯 빨강).
- 바닥(forest_floor, fallen_leaves, tall_grass, root_floor, stream, stepping_stone)은 불투명하고 가장자리가
  이어진다(무늬는 x % 16, y % 16). 외곽선 없이 무늬만, 바닥 위 작은 물체(디딤돌)만 외곽선.
- 물체(stump, log, mushroom_patch, signpost_fork, pine_tree, moss_stone)는 맵의 deco 레이어에 숲 바닥 위로 겹쳐
  그려지므로 배경이 투명하다(지역 1 tree·bush와 같은 방식). 바깥 외곽선은 auto_outline(재질 ol), 발치에 반투명 그림자.
- 빛은 왼쪽 위에서. 덩어리마다 3단(hi·base·shade) + spec 1~3px(monsters.Px.mass).
- 시간이 멈춘 숲: 낙엽 두 장이 공중에 멈춰 있고(아래에 그림자가 따로), 개울은 물결 모양 그대로 얼어붙은 얼음(sky 램프,
  흐르는 물 water 램프와 다른 색)이라 애니메이션이 없다. 가지 끝·바위 틈에 청록 서리(teal)가 앉았다.
- 숲 벽(pine_tree)은 맵의 대부분을 덮는 같은 타일이라, 한 칸 안에 키 큰 전나무(이끼빛)와 그 뒤의 둥근 활엽수(짙은 잎)를
  비대칭으로 겹쳐 반복이 '나무 한 그루 × 격자'로 읽히지 않게 한다(style-guide §4.4).
"""
from cozypal import auto_outline, c, noise, speckle
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


def _shadow(g, y, x0, x1):
    """발치 그림자: y줄의 x0..x1 중 투명한 칸을 반투명 그림자로."""
    for x in range(x0, x1 + 1):
        if 0 <= x < T and g[y][x] == ".":
            _put(g, x, y, c("shadow"))
    return g


def _under(base, top):
    """불투명 바닥 위에 물체 그리드를 얹는다('.'은 바닥이 비침)."""
    return ["".join(t if t != "." else b for b, t in zip(br, tr)) for br, tr in zip(base, top)]


# ── 바닥: 숲 바닥(이끼) ──────────────────────────────────────────────────────────
FLOOR = "moss"


def forest_floor(seed=211):
    """숲 바닥: 이끼 기본색 + 4×4 칸마다 많아야 하나('ㅅ'자 이끼 송이, 외잎, 그늘 점, 떨어진 솔잎).
    맵의 대부분을 덮어서 지역 1 풀보다 송이를 드물게, 대비를 낮게(spec 없음) 둔다."""
    base, hi, sh = c(f"{FLOOR}.base"), c(f"{FLOOR}.hi"), c(f"{FLOOR}.shade")
    g = _grid(lambda x, y: base)
    for y in range(0, T, 4):
        for x in range(0, T, 4):
            r = noise(x, y, seed)
            ox = x + int(noise(x, y, seed + 1) * 3)
            oy = y + int(noise(x, y, seed + 2) * 3)
            if r < 0.26:                                      # 'ㅅ'자 이끼 송이
                _set(g, ox - 1, oy, hi)
                _set(g, ox + 1, oy, hi)
                _set(g, ox, oy + 1, sh)
            elif r < 0.44:                                    # 외잎
                _set(g, ox, oy, hi)
                _set(g, ox, oy + 1, sh)
            elif r < 0.62:                                    # 그늘 점(흙이 비치는 곳)
                _set(g, ox, oy, sh)
                if noise(x, y, seed + 4) < 0.5:
                    _set(g, ox + 1, oy, sh)
            elif r < 0.70:                                    # 떨어진 솔잎(짙은 잎 대각선 2px)
                _set(g, ox, oy, c("leaf.shade"))
                _set(g, ox + 1, oy + 1, c("leaf.shade"))
    return g


FOREST_FLOOR = forest_floor()


# ── 바닥: 낙엽(바닥 + 공중에 멈춘 두 장) ─────────────────────────────────────────
# 잎 한 장(3×2): 왼쪽 위 밝음, 오른쪽 아래 그늘, 끝에 잎자루 1px
_LEAF = ((0, 0, "hi"), (1, 0, "base"), (0, 1, "base"), (1, 1, "base"), (2, 1, "shade"), (1, 2, "ol"))
LEAF_RAMPS = ("brick", "rust", "lamp")


def _leaf(g, x, y, ramp, flip=False):
    for dx, dy, step in _LEAF:
        if step == "ol" and ramp == "lamp":
            step = "shade"
        _set(g, x + (2 - dx if flip else dx), y + dy, c(f"{ramp}.{step}"))


def fallen_leaves():
    """숲 바닥에 떨어진 단풍 4장(빨강·주황·노랑) + 공중에 멈춘 2장. 떠 있는 잎은 3px 아래 바닥에
    그림자(이끼 그늘)가 따로 있고, 옆에 청록 서리 반짝임 1px(시간이 멈춘 표시)."""
    g = list(FOREST_FLOOR)
    for x, y, ramp, flip in ((2, 3, "brick", False), (10, 6, "rust", True), (5, 12, "lamp", False),
                             (12, 13, "brick", True)):
        _leaf(g, x, y, ramp, flip)
    for x, y, ramp, flip in ((9, 0, "rust", False), (1, 7, "brick", True)):
        for dx in range(3):                                   # 바닥 그림자(잎보다 3px 아래, 1px 오른쪽)
            _set(g, x + 1 + dx, y + 4, c(f"{FLOOR}.shade"))
        _leaf(g, x, y, ramp, flip)
        _set(g, x + 3, y, c("teal.hi"))
    return g


FALLEN_LEAVES = fallen_leaves()


# ── 바닥: 키 큰 풀(지나갈 수 있음) ───────────────────────────────────────────────
# 잎줄기(x, 높이, 밝음 여부). 아래 끝은 11행에 모인다. 왼쪽 줄기는 밝게(빛이 왼쪽 위), 오른쪽은 그늘
_BLADES = ((1, 5, 0), (2, 8, 1), (3, 6, 1), (4, 9, 1), (5, 7, 0), (6, 10, 1), (7, 6, 0), (8, 8, 1),
           (9, 11, 1), (10, 7, 0), (11, 9, 1), (12, 6, 0), (13, 8, 0), (14, 5, 0))


def tall_grass():
    """숲 바닥에 무릎 높이의 풀 한 무더기: 줄기마다 끝은 강조, 아래로 갈수록 그늘, 밑동에 그림자 줄."""
    g = list(FOREST_FLOOR)
    bottom = 12
    for x, h, lit in _BLADES:
        top = bottom - h
        lean = 1 if x < 7 else (-1 if x > 9 else 0)            # 끝이 바깥으로 살짝 휜다
        for y in range(top, bottom + 1):
            xx = x - lean if y < top + 2 else x
            if y == top:
                col = "moss.spec" if lit else "moss.hi"
            elif y < top + h // 2:
                col = "moss.hi" if lit else "moss.base"
            else:
                col = "moss.base" if lit else "moss.shade"
            _put(g, xx, y, c(col))
    for x in range(1, 15):                                     # 밑동 그늘과 바닥에 떨어진 그림자
        _put(g, x, bottom, c("moss.shade"))
        if 2 <= x <= 13:
            _put(g, x, bottom + 1, c("moss.ol") if x % 3 else c("moss.shade"))
    return g


TALL_GRASS = tall_grass()


# ── 바닥: 뿌리 길 ───────────────────────────────────────────────────────────────
def root_floor(seed=231):
    """다져진 흙길: 따뜻한 흙(sand 그늘 램프) + 닳은 자국·모래알 점, 조약돌, 떨어진 솔잎.
    가운데에 'Y'자로 갈라지는 뿌리 하나(갈림길 숲의 표식). 뿌리는 칸 가장자리에 닿지 않게 흙 속으로 들어가서
    길이 길게 이어져도 줄무늬·사다리로 반복되지 않는다."""
    g = _grid(lambda x, y: c("sand.shade"))
    g = speckle(g, "sand.shade", "soil.shade", 0.06, seed)
    g = speckle(g, "sand.shade", "sand.base", 0.035, seed + 1)
    for x, y in ((3, 2), (12, 11)):                             # 조약돌(밝음 2 + 그늘 2)
        _set(g, x, y, c("sand.hi"))
        _set(g, x + 1, y, c("sand.base"))
        _set(g, x, y + 1, c("soil.shade"))
        _set(g, x + 1, y + 1, c("sand.ol"))
    for x, y in ((13, 3), (1, 13)):                             # 떨어진 솔잎
        _set(g, x, y, c("leaf.shade"))
        _set(g, x + 1, y + 1, c("leaf.shade"))
    # 가는 뿌리: 흙 위로 1px 드러난 줄기(기본) + 아래 그늘, 끝은 흙에 묻혀 그늘로. 'Y'자로 한 번 갈라진다.
    # 외곽선을 두르지 않고 낮은 대비로 둬서 길이 길게 이어져도 무늬가 튀지 않는다
    for x, y in ((3, 8), (4, 8), (5, 7), (6, 7), (7, 7), (8, 6), (9, 5), (8, 8), (9, 9), (10, 9)):
        _set(g, x, y, c("wood.base"))
        _set(g, x, y + 1, c("wood.shade"))
    for x, y in ((2, 9), (10, 4), (11, 10)):
        _set(g, x, y, c("wood.shade"))
    _set(g, 6, 6, c("wood.hi"))
    return g


ROOT_FLOOR = root_floor()


# ── 바닥: 얼어붙은 개울 ─────────────────────────────────────────────────────────
ICE = "sky"


def stream():
    """물결 모양 그대로 얼어붙은 개울: 얼음(sky 램프) 바탕에 굳은 물결(밝음 + 바로 위 강조, 아래 그늘),
    얼음 속 깊은 그늘 얼룩, 가는 금(그늘 지그재그), 갇힌 공기방울(흰 점), 얼음 속에 멈춘 낙엽 한 장.
    흐르는 물(water 램프, 애니메이션)과 달리 색이 밝고 차갑고 움직이지 않는다."""
    base, hi, sh, sp = (c(f"{ICE}.{s}") for s in ("base", "hi", "shade", "spec"))
    g = _grid(lambda x, y: base)
    # 얼음 아래 깊은 물빛(굳은 물결 사이 골에 고인 짙은 색, 가로로 긴 얼룩)
    for x, y, n in ((5, 6, 4), (12, 11, 4), (0, 14, 3), (9, 1, 3)):
        for k in range(n):
            _set(g, x + k, y, c("water.hi"))
    # 굳은 물결: 길게 굽은 활(위 밝음, 끝은 그늘로 꺾임, 바로 아래 그늘 줄). 흐르는 물과 같은 가로 결이 멈춰 있다
    for x, y, n in ((1, 3, 6), (10, 5, 5), (3, 10, 6), (12, 14, 4)):
        for k in range(n):
            _set(g, x + k, y, hi)
            _set(g, x + k, y + 1, sh)
        _set(g, x - 1, y + 1, hi)
        _set(g, x + n, y + 1, hi)
        _set(g, x + 1, y, sp)
    # 얼음에 간 가는 금(그늘 지그재그)
    for x, y in ((13, 0), (14, 1), (14, 2), (6, 12), (7, 13), (7, 14)):
        _set(g, x, y, sh)
    # 갇힌 공기방울 하나
    _set(g, 8, 8, c("white"))
    return g


STREAM = stream()


def stepping_stone():
    """얼어붙은 개울 위의 납작한 디딤돌: 둥근 돌(stone) 위에 이끼 한 줌, 가장자리에 서리, 얼음에 비친 그늘."""
    p = Px()
    rock = ellipse(8, 8.5, 6.2, 4.6)
    p.mass(rock, "stone", shade_below=11)
    for x, y in ((5, 6), (6, 6), (7, 5), (8, 5), (9, 5), (6, 5), (10, 6), (7, 6)):   # 이끼 한 줌
        p.put(x, y, "moss.base")
    for x, y in ((6, 5), (7, 5), (5, 6)):
        p.put(x, y, "moss.hi")
    p.put(8, 6, "moss.shade")
    p.put(9, 6, "moss.shade")
    for x, y in ((11, 9), (4, 10)):                                   # 돌 얼룩
        p.put(x, y, "stone.shade")
    p.put(12, 7, "teal.hi")                                          # 서리
    g = p.grid()
    base = list(STREAM)
    for x in range(4, 13):                                           # 얼음에 비친 돌 그늘
        _put(base, x, 14, c(f"{ICE}.shade"))
    return _under(base, g)


STEPPING_STONE = stepping_stone()


# ── 물체: 숲 벽(전나무 + 활엽수) ───────────────────────────────────────────────
def _tier(cx, y0, y1, w0, w1):
    """전나무 한 층: y0행 반폭 w0 → y1행 반폭 w1인 사다리꼴. 아래 가장자리는 가지 끝처럼 들쭉날쭉."""
    cells = set()
    for y in range(y0, y1 + 1):
        t = (y - y0) / max(1, y1 - y0)
        hw = w0 + (w1 - w0) * t
        for x in range(T):
            if abs(x + 0.5 - cx) <= hw:
                cells.add((x, y))
    # 맨 아래 줄은 한 칸 건너 가지 끝만 남긴다(톱니)
    for x in range(T):
        if (x, y1) in cells and (x + y1) % 3 == 0 and abs(x + 0.5 - cx) > 1:
            cells.discard((x, y1))
    return cells


def pine_tree():
    """숲 벽 한 칸: 오른쪽 뒤에 둥근 활엽수(짙은 잎, 지역 1 나무처럼 풀빛 잎 송이), 왼쪽 앞에 키 큰 전나무(이끼빛 층층,
    가지 끝에 청록 서리). 두 그루가 칸을 거의 채워서 숲이 이어진 덩어리로 보이고, 키·모양·색이 달라 단조롭지 않다."""
    p = Px()
    # 뒤: 둥근 활엽수(오른쪽 위)와 줄기
    for y in range(10, 15):
        p.put(11, y, "wood.base")
        p.put(12, y, "wood.shade")
    p.put(10, 14, "wood.hi")
    p.put(13, 14, "wood.shade")
    crown = ellipse(11.6, 6.4, 4.6, 4.9) | ellipse(13.4, 8.6, 2.8, 2.6)
    p.mass(crown, "leaf")
    for x, y in ((9, 3), (10, 3), (11, 2), (12, 2), (10, 5), (14, 6)):     # 풀빛 잎 송이(지역 1 나무와 같은 연두)
        if p.get(x, y):
            p.put(x, y, "grass.base")
    for x, y in ((10, 2), (12, 1)):
        if p.get(x, y):
            p.put(x, y, "grass.hi")
    for x, y in ((13, 9), (15, 8), (12, 10)):                              # 잎덩이 아래 깊은 그늘
        if p.get(x, y):
            p.put(x, y, "leaf.ol")
    # 앞: 전나무(왼쪽, 위에서 아래로 층을 겹친다. 아래 층이 위 층의 밑동을 덮는다)
    cx = 5.5
    for y in range(12, 15):
        p.put(5, y, "wood.base")
        p.put(6, y, "wood.shade")
    p.put(4, 14, "wood.hi")
    # 숲 벽은 바닥보다 한 단계 어둡게(style-guide §3.4): 3단 음영을 한 단계씩 내려 칠한다(밝음→기본, 기본→그늘, 그늘→외곽선)
    down = {"moss.hi": "moss.base", "moss.base": "moss.shade", "moss.shade": "moss.ol"}
    for y0, y1, w0, w1 in ((0, 3, 0.4, 1.9), (2, 6, 1.0, 3.4), (5, 9, 1.6, 4.6), (8, 12, 2.2, 5.6)):
        cells = _tier(cx, y0, y1, w0, w1)
        p.mass(cells, "moss")
        for x, y in cells:
            p.put(x, y, down[p.get(x, y)])
    for x, y in ((4, 2), (3, 5), (2, 8), (1, 11)):                          # 층마다 왼쪽 가지 끝 강조
        if p.get(x, y):
            p.put(x, y, "moss.hi")
    for x, y in ((8, 6), (10, 11)):                                        # 오른쪽 가지 끝 청록 서리
        if p.get(x, y):
            p.put(x, y, "teal.hi")
    g = p.grid()
    g = _shadow(g, 15, 2, 14)
    return g


PINE_TREE = pine_tree()


# ── 물체: 그루터기·통나무 ───────────────────────────────────────────────────────
def stump():
    """그루터기: 위에서 본 나이테(밝은 나무 + 나이테 그늘), 세로 결 껍질 옆면, 밑동 뿌리, 왼쪽에 이끼,
    오른쪽 뿌리 틈에 작은 빨간 버섯."""
    p = Px()
    side = {(x, y) for x in range(2, 14) for y in range(7, 13)}
    side |= {(1, 12), (14, 12), (1, 11), (14, 11), (0, 12), (15, 12)}       # 뿌리 퍼짐
    p.mass(side, "wood", shade_below=11)
    for x in range(3, 13, 3):                                               # 껍질 세로 결
        for y in range(8, 12):
            if (x + y) % 2 == 0:
                p.put(x, y, "wood.shade")
    top = ellipse(8, 6.5, 6.2, 3.6)
    for x, y in top:
        p.put(x, y, "wood.hi")
    for x, y in ellipse(8, 6.5, 4.4, 2.5) - ellipse(8, 6.5, 3.3, 1.7):     # 나이테
        p.put(x, y, "wood.base")
    for x, y in ellipse(8, 6.5, 2.2, 1.2) - ellipse(8, 6.5, 1.2, 0.6):
        p.put(x, y, "wood.base")
    p.put(7, 6, "wood.shade")                                              # 한가운데 심
    p.put(4, 5, "wood.spec")
    p.put(5, 4, "wood.spec")
    for x, y in ((2, 8), (2, 9), (3, 9), (2, 10), (3, 11), (2, 11), (1, 11)):   # 이끼
        p.put(x, y, "moss.base")
    p.put(2, 8, "moss.hi")
    p.put(2, 9, "moss.hi")
    for x, y, col in ((13, 9, "brick.hi"), (14, 9, "brick.base"), (12, 9, "brick.base"),
                      (13, 10, "cream.hi"), (14, 10, "brick.shade")):
        p.put(x, y, col)
    g = p.grid()
    return _shadow(g, 14, 1, 14)


STUMP = stump()


def log():
    """쓰러진 통나무(가로): 왼쪽 끝은 잘린 면의 나이테, 몸통은 짙은 껍질 결, 위에 이끼가 얹혀 아래로 조금 늘어진다."""
    p = Px()
    body = {(x, y) for x in range(3, 15) for y in range(6, 12)} - {(14, 6), (14, 11)}
    p.mass(body, "wood", shade_below=10)
    for x in range(4, 14):                                     # 껍질 가로 결
        if x % 3 != 1:
            p.put(x, 8, "wood.shade")
        if x % 4 == 2:
            p.put(x, 10, "wood.ol")
    end = ellipse(3, 9, 2.6, 3.2)                              # 잘린 면
    for x, y in end:
        p.put(x, y, "wood.hi")
    for x, y in ellipse(3, 9, 1.6, 2.1) - ellipse(3, 9, 0.8, 1.1):
        p.put(x, y, "wood.base")
    p.put(2, 7, "wood.spec")
    for x in range(5, 13):                                     # 위에 얹힌 이끼
        p.put(x, 5, "moss.hi" if x % 4 else "moss.spec")
        p.put(x, 6, "moss.base")
        if x % 3 == 0:
            p.put(x, 7, "moss.shade")
    p.put(6, 4, "moss.hi")
    p.put(10, 4, "moss.hi")
    p.put(11, 6, "teal.hi")                                    # 이끼 끝 서리
    g = p.grid()
    return _shadow(g, 13, 1, 15)


LOG = log()


# ── 물체: 버섯 무리(지나갈 수 있음) ─────────────────────────────────────────────
def _cap(p, cx, top, w, ramp):
    """버섯 갓: 반타원(폭 w), 위 가장자리 밝음, 아래 테두리 그늘, 흰 점."""
    cells = {(x, y) for x, y in ellipse(cx, top + 2.4, w / 2, 2.6) if y <= top + 2}
    p.mass(cells, ramp)
    return cells


def mushroom_patch():
    """빨간 버섯 두 송이(큰 것·작은 것)와 시간이 멈춰 청록으로 빛나는 작은 버섯 하나. 바닥 위 장식이라 낮게."""
    p = Px()
    # 큰 빨간 버섯(왼쪽)
    for y in (8, 9, 10):
        p.put(4, y, "cream.hi")
        p.put(5, y, "cream.base")
    _cap(p, 4.6, 4, 8, "brick")
    for x, y in ((3, 5), (6, 6), (2, 7)):
        p.put(x, y, "cream.spec")
    # 작은 빨간 버섯(가운데 아래)
    p.put(9, 12, "cream.hi")
    p.put(9, 13, "cream.base")
    _cap(p, 9.5, 9, 5, "brick")
    p.put(9, 10, "cream.spec")
    # 청록으로 빛나는 버섯(오른쪽 위)
    for y in (6, 7):
        p.put(12, y, "cream.hi")
    _cap(p, 12.5, 3, 5, "teal")
    p.put(12, 4, "teal.spec")
    g = p.grid(skip=())
    g = _shadow(g, 11, 2, 7)
    g = _shadow(g, 14, 8, 11)
    g = _shadow(g, 8, 11, 14)
    _put(g, 14, 2, c("sparkle"))                               # 청록 버섯 위 작은 반짝임
    return g


MUSHROOM_PATCH = mushroom_patch()


# ── 물체: 갈림길 이정표 ─────────────────────────────────────────────────────────
def signpost_fork():
    """갈림길 이정표: 기둥 하나에 서로 반대쪽(왼쪽 위·오른쪽 아래)을 가리키는 화살표 판 두 장과, 위로 향한 작은 판.
    판에 새긴 글자 줄(그늘), 밑동에 이끼와 풀."""
    p = Px()
    for y in range(1, 14):                                       # 기둥
        p.put(7, y, "wood.hi")
        p.put(8, y, "wood.shade")
    p.put(7, 0, "wood.hi")
    # 왼쪽을 가리키는 판(위)
    left = {(x, y) for x in range(2, 12) for y in range(2, 5)} | {(1, 3)}
    p.mass(left, "wood")
    # 오른쪽을 가리키는 판(가운데)
    right = {(x, y) for x in range(4, 14) for y in range(7, 10)} | {(14, 8)}
    p.mass(right, "plank")
    for x in (4, 6, 8, 9):                                       # 새긴 글자
        p.put(x, 3, "wood.ol")
    for x in (6, 7, 9, 11):
        p.put(x, 8, "plank.ol")
    p.put(10, 3, "teal.base")                                    # 판 끝의 청록 표식
    p.put(5, 8, "brick.base")
    for x, y in ((6, 13), (9, 13), (5, 13), (10, 13), (6, 12), (9, 12)):   # 밑동 이끼·풀
        p.put(x, y, "moss.base")
    p.put(6, 12, "moss.hi")
    p.put(9, 12, "moss.hi")
    g = p.grid()
    return _shadow(g, 14, 4, 11)


SIGNPOST_FORK = signpost_fork()


# ── 물체: 이끼 바위 ─────────────────────────────────────────────────────────────
def moss_stone():
    """이끼 바위: 둥근 청회 바위(stone) 위에 이끼 모자(위 가장자리가 들쭉날쭉 늘어짐), 갈라진 틈에 청록 서리."""
    p = Px()
    rock = ellipse(8, 8.8, 6.8, 5.4)
    p.mass(rock, "stone", shade_below=12)
    moss = {(x, y) for x, y in rock if y <= 6 or (y == 7 and noise(x, 7, 5) < 0.6) or (y == 8 and x % 4 == 1)}
    moss = {(x, y) for x, y in moss if x < 12 or y <= 5}
    p.mass(moss, "moss")
    for x, y in ((4, 4), (6, 3)):
        p.put(x, y, "moss.spec")
    for x, y in ((10, 9), (11, 10), (11, 11), (12, 12)):         # 갈라진 틈
        p.put(x, y, "stone.ol")
    p.put(10, 10, "teal.hi")
    p.put(5, 11, "stone.shade")
    p.put(7, 10, "stone.shade")
    g = p.grid()
    return _shadow(g, 14, 2, 14)


MOSS_STONE = moss_stone()


FOREST_TILES = {
    "forest_floor": FOREST_FLOOR,
    "fallen_leaves": FALLEN_LEAVES,
    "tall_grass": TALL_GRASS,
    "stump": STUMP,
    "log": LOG,
    "mushroom_patch": MUSHROOM_PATCH,
    "stream": STREAM,
    "stepping_stone": STEPPING_STONE,
    "signpost_fork": SIGNPOST_FORK,
    "pine_tree": PINE_TREE,
    "moss_stone": MOSS_STONE,
    "root_floor": ROOT_FLOOR,
}

# 미리보기에서 투명 물체 타일 밑에 깔 바닥(게임에서는 맵의 ground 레이어가 깔린다)
DECO_UNDER = {n: "forest_floor" for n in ("stump", "log", "mushroom_patch", "signpost_fork", "pine_tree", "moss_stone")}
