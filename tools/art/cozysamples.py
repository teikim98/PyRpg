"""화풍 가이드용 재질 샘플 타일(16×16). 게임 에셋이 아니라 docs/art-overhaul/materials.png의 기준 구현이다.

지역 1 타일 담당은 이 함수들을 그대로 가져다 쓰거나 고쳐 쓴다(style-guide.md §4).
모든 무늬는 좌표 해시(cozypal.noise)로 정해서 결정적이고, 가장자리를 넘어 이어 붙여도 이음새가 보이지 않게
x, y를 16으로 나눈 나머지로 계산한다.
"""
from cozypal import c, noise, speckle

T = 16


def _grid(fn):
    return ["".join(fn(x, y) for x in range(T)) for y in range(T)]


def _set(g, x, y, ch):
    x %= T
    y %= T
    g[y] = g[y][:x] + ch + g[y][x + 1:]


def grass(seed=11):
    """풀: 기본색 바탕 + 풀잎 송이('ㅅ'자 밝은 잎 2픽셀 + 아래 그늘 1픽셀) + 드문 강조점."""
    base, hi, sh, sp = c("grass.base"), c("grass.hi"), c("grass.shade"), c("grass.spec")
    g = _grid(lambda x, y: base)
    for y in range(0, T, 4):
        for x in range(0, T, 4):
            # 4×4 칸마다 많아야 한 송이, 칸 안의 위치도 해시로
            r = noise(x, y, seed)
            ox = x + int(noise(x, y, seed + 1) * 3)
            oy = y + int(noise(x, y, seed + 2) * 3)
            if r < 0.30:                                     # 'ㅅ'자 송이
                _set(g, ox - 1, oy, hi)
                _set(g, ox + 1, oy, hi)
                _set(g, ox, oy + 1, sh)
                if noise(x, y, seed + 3) < 0.25:
                    _set(g, ox, oy - 1, sp)
            elif r < 0.50:                                   # 외잎(밝음 1 + 그늘 1)
                _set(g, ox, oy, hi)
                _set(g, ox, oy + 1, sh)
            elif r < 0.62:                                   # 그늘 점(땅이 비치는 곳)
                _set(g, ox, oy, sh)
    return g


def path(seed=21):
    """흙길(모래): 기본색 + 그늘 점(닳은 자국) 7% + 밝은 점 4% + 조약돌(밝음 2px + 그늘 1px) 두어 개."""
    g = _grid(lambda x, y: c("sand.base"))
    g = speckle(g, "sand.base", "sand.shade", 0.07, seed)
    g = speckle(g, "sand.base", "sand.hi", 0.04, seed + 1)
    for k, (x, y) in enumerate(((4, 5), (11, 12))):
        _set(g, x, y, c("sand.hi"))
        _set(g, x + 1, y, c("sand.hi"))
        _set(g, x, y + 1, c("sand.shade"))
        _set(g, x + 1, y + 1, c("soil.shade"))
    return g


def grass_edge_over_path(seed=31):
    """길 위쪽 경계: 위 칸의 풀이 덤불처럼 2~4px 넘어와 들쭉날쭉하게 늘어진다(레퍼런스의 풀 덤불)."""
    g = path(seed)
    base, hi, sh, ol = c("grass.base"), c("grass.hi"), c("grass.shade"), c("grass.ol")
    for x in range(T):
        depth = 1 + int(noise(x // 2, 0, seed) * 3)        # 2픽셀 폭 잎 덩어리마다 1~3px
        for y in range(depth):
            _set(g, x, y, base if y < depth - 1 else sh)
        if x % 2 == 0 and noise(x, 1, seed) < 0.5:
            _set(g, x, depth, sh)                           # 잎 끝이 한 칸 더 늘어짐
            _set(g, x, depth + 1, ol)
        else:
            _set(g, x, depth, ol)                           # 잎 아래 짙은 그림자 선(외곽선 색)
        if noise(x, 2, seed) < 0.3:
            _set(g, x, 0, hi)
    return g


def flagstone(seed=41):
    """판석: 크기가 다른 돌 4장, 줄눈은 재질 외곽선 색, 돌마다 왼쪽·위 밝음 1px, 오른쪽·아래 그늘 1px, 질감 점."""
    ol, sh, base, hi = c("stone.ol"), c("stone.shade"), c("stone.base"), c("stone.hi")
    # (x0, y0, x1, y1) 끝 포함. 가장자리 줄눈은 오른쪽·아래에만 둬서 이어 붙여도 한 줄
    stones = [(0, 0, 8, 6), (10, 0, 14, 6), (0, 8, 4, 14), (6, 8, 14, 14)]
    g = _grid(lambda x, y: ol)
    for x0, y0, x1, y1 in stones:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                ch = base
                if x == x0 or y == y0:
                    ch = hi
                elif x == x1 or y == y1:
                    ch = sh
                _set(g, x, y, ch)
    g = speckle(g, "stone.base", "stone.shade", 0.08, seed)
    g = speckle(g, "stone.base", "moss.base", 0.025, seed + 1)   # 틈에 낀 이끼
    return g


def planks(seed=51):
    """나무 판자 벽: 세로 판자 4장(폭 4), 이음새는 외곽선 색, 판자마다 밝기를 조금씩 바꾸고 못·닳은 점."""
    ol, sh, base, hi = c("wood.ol"), c("wood.shade"), c("wood.base"), c("wood.hi")
    g = []
    for y in range(T):
        row = ""
        for x in range(T):
            k = x // 4
            if x % 4 == 3:
                row += ol                                    # 이음새
            elif x % 4 == 2:
                row += sh                                    # 판자 오른쪽 그늘 1px
            elif x % 4 == 0 and k != 2:
                row += hi                                    # 판자 왼쪽 밝음 1px(한 장은 빼서 단조로움을 깸)
            else:
                row += base
        g.append(row)
    for k in range(4):
        y = 2 + int(noise(k, 0, seed) * 10)
        _set(g, k * 4 + 1, y, ol)                            # 옹이
        _set(g, k * 4 + 1, 1, c("cream.hi"))                 # 못
        _set(g, k * 4 + 1, 14, c("cream.hi"))
    g = speckle(g, "wood.base", "wood.shade", 0.06, seed + 2)
    return g


def metal_panel(seed=61):
    """크림 금속판(레퍼런스의 컨테이너 벽을 마을 회벽·금속판으로): 판 이음새, 리벳, 녹 물때가 위에서 아래로 흐른다."""
    ol, sh, base, hi = c("cream.ol"), c("cream.shade"), c("cream.base"), c("cream.hi")
    g = _grid(lambda x, y: ol if y == 15 or x == 15 else (hi if y == 0 or x == 0 else (sh if y == 14 or x == 14 else base)))
    for x, y in ((2, 2), (12, 2), (2, 12), (12, 12)):
        _set(g, x, y, sh)
        _set(g, x - 1, y - 1, hi)
    # 녹 물때: 리벳 아래로 흐르는 옅은 녹 줄(위는 녹 밝음, 아래로 갈수록 바탕에 섞이게 한 칸씩 건너뜀)
    for x, n in ((2, 5), (12, 3)):
        for k in range(n):
            if k < 2 or k % 2 == 0:
                _set(g, x, 4 + k, c("rust.hi") if k == 0 else c("cream.shade"))
    _set(g, 7, 9, c("rust.hi"))
    _set(g, 8, 9, c("cream.shade"))
    g = speckle(g, "cream.base", "cream.shade", 0.05, seed + 1)
    return g


def barn_board(seed=71):
    """빨간 널빤지 벽(탁한 분홍): 가로 널 3장, 아래쪽이 바랜 흰 얼룩, 이음새 외곽선 색."""
    ol, sh, base, hi = c("brick.ol"), c("brick.shade"), c("brick.base"), c("brick.hi")
    g = []
    for y in range(T):
        if y % 5 == 4 or y == 15:
            g.append(ol * T)
        elif y % 5 == 0:
            g.append(hi * T)
        else:
            g.append(base * T)
    g = speckle(g, "brick.base", "brick.shade", 0.10, seed)
    g = speckle(g, "brick.base", "cream.hi", 0.03, seed + 1)
    return g


def water(frame=0, seed=81):
    """물(3프레임 애니메이션): 기본색 바탕, 짧은 물결 줄(밝음 2~3px)이 프레임마다 오른쪽으로 2px 흐르고,
    물결 아래 1px은 그늘. 강조 반짝임 점은 프레임마다 다른 자리에 하나."""
    base, hi, sh, sp = c("water.base"), c("water.hi"), c("water.shade"), c("water.spec")
    g = _grid(lambda x, y: base)
    for i, (x, y, n) in enumerate(((1, 2, 3), (9, 4, 2), (4, 8, 3), (12, 10, 3), (2, 13, 2), (8, 14, 2))):
        x += frame * 2
        for k in range(n):
            _set(g, x + k, y, hi)
            _set(g, x + k, y + 1, sh)
    sx, sy = ((6, 5), (13, 7), (3, 11))[frame % 3]
    _set(g, sx, sy, sp)
    return g


def bush_on_grass(seed=91):
    """풀 덤불(한 칸 오브젝트 예시): 큼직한 잎 덩어리 3개, 왼쪽 위 밝음, 아래쪽 그늘, 외곽선은 잎의 외곽선 색."""
    g = grass(seed)
    ol, sh, base, hi, sp = (c(f"grass.{s}") for s in ("ol", "shade", "base", "hi", "spec"))
    lsh = c("leaf.shade")
    blobs = [(5, 8, 4), (10, 7, 4), (8, 11, 4)]

    def inside(x, y):
        return any((x - bx) ** 2 + (y - by) ** 2 <= r * r for bx, by, r in blobs)

    for y in range(T):
        for x in range(T):
            if inside(x, y):
                dark = not inside(x + 1, y + 1)
                light = not inside(x - 1, y - 1)
                _set(g, x, y, lsh if dark and y > 9 else (hi if light else (sh if dark else base)))
            elif inside(x - 1, y) or inside(x + 1, y) or inside(x, y - 1) or inside(x, y + 1):
                _set(g, x, y, ol)
    for x, y in ((6, 6), (11, 5), (9, 9)):
        _set(g, x, y, sp)
    return g


def flower_patch(seed=101):
    """풀 위 꽃: 분홍 꽃(4픽셀 십자 + 노란 가운데)과 흰 꽃 하나. 채도 높은 색은 작게만."""
    g = grass(seed)
    for (x, y, ramp) in ((4, 4, "flower"), (11, 10, "flower"), (6, 12, "cloth_white")):
        for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
            _set(g, x + dx, y + dy, c(f"{ramp}.hi"))
        _set(g, x + 1, y + 1, c(f"{ramp}.shade"))
        _set(g, x, y, c("lamp.hi"))
    return g


SAMPLES = [
    ("grass", grass()),
    ("flower", flower_patch()),
    ("bush", bush_on_grass()),
    ("path", path()),
    ("grass_edge", grass_edge_over_path()),
    ("flagstone", flagstone()),
    ("planks", planks()),
    ("metal", metal_panel()),
    ("barn", barn_board()),
    ("water_0", water(0)),
    ("water_1", water(1)),
    ("water_2", water(2)),
]
