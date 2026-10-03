"""지역 1(에코 마을) 지형 타일(16×16). 순서는 assets/manifest.json의 tilesets.overworld.tiles를 따른다.

그래픽 개편(docs/art-overhaul/style-guide.md): 코지 팔레트(cozypal)의 이름 있는 색만 쓴다.
- 바닥(grass, path, plaza_stone, water, house_wall, house_roof, wall_stone, floor_*, stairs, clocktower_wall,
  dark_floor)은 불투명하고 가장자리가 이어진다(무늬는 x % 16, y % 16). 외곽선 없이 이음새만 재질 ol로.
- 물체(well, tree, bush, fence, lamp_post, crate, market_stall, flower_bed)는 deco 레이어에 바닥 위로 겹쳐
  그려지므로 배경이 투명하다. 바깥 외곽선은 auto_outline(재질 ol), 발치에 반투명 그림자 1~2px.
- 빛은 왼쪽 위에서. 덩어리마다 3단(hi·base·shade) + spec 1~3px, 질감 점은 speckle(결정적).
- 애니메이션 프레임(water_a1·water_a2, grass_flower_a1, flower_bed_a1)은 타일셋 끝에 붙고
  manifest `tileAnimations`가 묶는다. 멈춘 세계 설정상 우물의 솟은 물기둥은 움직이지 않는다.
"""
from cozypal import auto_outline, c, noise, paint, speckle
from gridlib import overlay

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
    if 0 <= x < len(g[0]) and 0 <= y < len(g):
        g[y] = g[y][:x] + ch + g[y][x + 1:]


def _shadow(g, y, x0, x1):
    """발치 그림자: y줄의 x0..x1 중 투명한 칸을 반투명 그림자로."""
    sh = c("shadow")
    for x in range(x0, x1 + 1):
        if 0 <= x < len(g[0]) and g[y][x] == ".":
            _put(g, x, y, sh)
    return g


def _lit(x, y, ramp, cx, cy, r, seed):
    """덩어리 안 한 점의 3단 음영(빛은 왼쪽 위). 경계 근처는 2픽셀 덩어리 해시로 들쭉날쭉하게."""
    d = ((x - cx) * 0.8 + (y - cy)) / max(r, 1)
    j = (noise(x // 2, y // 2, seed) - 0.5) * 0.5
    if d + j < -0.55:
        return c(f"{ramp}.hi")
    if d + j > 0.45:
        return c(f"{ramp}.shade")
    return c(f"{ramp}.base")


def foliage(blobs, ramp="leaf", seed=0, w=T, h=T, dark_ramp=None, specs=()):
    """잎 덩어리: 원(cx, cy, r) 여러 개를 뒤에서 앞으로 겹친다. 덩어리마다 3단 음영, 겹친 경계는 그늘 1px,
    맨 아래 바깥 가장자리는 dark_ramp.shade로 한 단계 더 어둡게. 외곽선은 그리지 않는다(auto_outline)."""
    g = ["." * w for _ in range(h)]
    owner = [[-1] * w for _ in range(h)]
    for k, (cx, cy, r) in enumerate(blobs):
        for y in range(h):
            for x in range(w):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r + r * 0.6:
                    owner[y][x] = k
                    _put(g, x, y, _lit(x, y, ramp, cx, cy, r, seed + k))
    sh = c(f"{ramp}.shade")
    for y in range(h):
        for x in range(w):
            k = owner[y][x]
            if k < 0:
                continue
            # 뒤 덩어리가 앞 덩어리 아래로 들어가는 경계: 앞 덩어리 바로 바깥(뒤 덩어리 쪽)에 그늘 1px
            for dx, dy in ((0, -1), (1, 0), (-1, 0)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and owner[ny][nx] > k and g[y][x] != sh:
                    if (nx - blobs[owner[ny][nx]][0]) ** 2 + (ny - blobs[owner[ny][nx]][1]) ** 2 > (blobs[owner[ny][nx]][2] - 1.2) ** 2:
                        _put(g, nx, ny, sh)
            # 아래 바깥 가장자리
            if dark_ramp and (y + 1 >= h or owner[y + 1][x] < 0) and y > h // 3:
                _put(g, x, y, c(f"{dark_ramp}.shade"))
    for x, y in specs:
        _put(g, x, y, c(f"{ramp}.spec"))
    return g


# ── 바닥: 풀 ─────────────────────────────────────────────────────────────────────
def grass(seed=11):
    """풀: 기본색 바탕 + 4×4 칸마다 많아야 한 송이('ㅅ'자 밝은 잎 + 아래 그늘), 외잎, 그늘 점."""
    base, hi, sh, sp = c("grass.base"), c("grass.hi"), c("grass.shade"), c("grass.spec")
    g = _grid(lambda x, y: base)
    for y in range(0, T, 4):
        for x in range(0, T, 4):
            r = noise(x, y, seed)
            ox = x + int(noise(x, y, seed + 1) * 3)
            oy = y + int(noise(x, y, seed + 2) * 3)
            if r < 0.34:                                      # 'ㅅ'자 송이
                _set(g, ox - 1, oy, hi)
                _set(g, ox + 1, oy, hi)
                _set(g, ox, oy + 1, sh)
                if noise(x, y, seed + 3) < 0.25:
                    _set(g, ox, oy - 1, sp)
            elif r < 0.56:                                    # 외잎
                _set(g, ox, oy, hi)
                _set(g, ox, oy + 1, sh)
            elif r < 0.72:                                    # 그늘 점(땅이 비치는 곳)
                _set(g, ox, oy, sh)
                if noise(x, y, seed + 4) < 0.5:
                    _set(g, ox + 1, oy, sh)
    return g


GRASS = grass()


def _flower(g, x, y, ramp):
    """십자 4px 꽃잎(hi) + 가운데 lamp.hi + 오른쪽 아래 그늘 1px."""
    for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
        _set(g, x + dx, y + dy, c(f"{ramp}.hi"))
    _set(g, x + 1, y + 1, c(f"{ramp}.shade"))
    _set(g, x, y, c("lamp.hi"))


FLOWERS = ((4, 4, "flower"), (11, 10, "flower"), (5, 12, "cloth_white"))


def grass_flower(frame=0):
    """풀 위 꽃 3송이. 애니메이션 프레임은 꽃이 바람에 1px 흔들린다(첫째·셋째는 오른쪽, 둘째는 위로)."""
    g = list(GRASS)
    for k, (x, y, ramp) in enumerate(FLOWERS):
        dx, dy = ((1, 0), (0, -1), (1, 0))[k] if frame else (0, 0)
        _set(g, x, y + 2, c("grass.shade"))                 # 꽃대 그늘
        _flower(g, x + dx, y + dy, ramp)
    return g


GRASS_FLOWER = grass_flower(0)
GRASS_FLOWER_A1 = grass_flower(1)


# ── 바닥: 흙길·광장 ──────────────────────────────────────────────────────────────
def path(seed=21):
    """흙길: 모래 기본색 + 닳은 자국 7% + 모래알 4% + 조약돌 2개 + 길 틈에 돋은 풀 한 포기."""
    g = _grid(lambda x, y: c("sand.base"))
    g = speckle(g, "sand.base", "sand.shade", 0.07, seed)
    g = speckle(g, "sand.base", "sand.hi", 0.04, seed + 1)
    for x, y in ((3, 5), (11, 12)):
        _set(g, x, y, c("sand.hi"))
        _set(g, x + 1, y, c("sand.spec"))
        _set(g, x, y + 1, c("sand.shade"))
        _set(g, x + 1, y + 1, c("soil.shade"))
    # 바퀴 자국처럼 옅게 닳은 분홍 흙 얼룩
    for x, y in ((8, 2), (9, 2), (1, 9), (14, 7), (6, 14)):
        _set(g, x, y, c("soil.hi"))
    # 길 틈의 풀 한 포기('ㅅ' + 그림자)
    _set(g, 12, 3, c("grass.hi"))
    _set(g, 14, 3, c("grass.hi"))
    _set(g, 13, 4, c("grass.shade"))
    _set(g, 13, 5, c("sand.shade"))
    return g


PATH = path()

# 광장 판석: 크기가 다른 돌을 손으로 배치(가장자리를 넘어 감겨서 이어 붙여도 격자가 덜 보인다).
# 같은 글자 = 돌 한 장, '#' = 줄눈. 돌마다 왼쪽·위 가장자리 밝음, 오른쪽·아래 그늘.
_PLAZA_LAYOUT = """
aaa#bbbbbbb#aaaa
aaa#bbbbbbb#aaaa
aaa#bbbbbbb#aaaa
aaa#bbbbbbb#aaaa
###########c####
dddddd#eeeec#fff
dddddd#eeeec#fff
dddddd#eeeec#fff
dddddd#eeeec#fff
dddddd#eeeec#fff
##g########c#fff
hhg#iiiiiii#####
hhg#iiiiiii#jjhh
hhg#iiiiiii#jjhh
hhg#iiiiiii#jjhh
################
"""


def _slabs(layout, tones, seed, moss=0.0, speck=0.07, round_=False):
    """손으로 배치한 판석. tones = (줄눈, 그늘, 기본, 밝음) 색 이름. 돌마다 왼쪽·위 밝음, 오른쪽·아래 그늘."""
    rows = layout.strip().splitlines()
    mortar, sh, base, hi = (c(n) for n in tones)

    def at(x, y):
        return rows[y % T][x % T]

    out = []
    for y in range(T):
        row = ""
        for x in range(T):
            k = at(x, y)
            corner = (at(x - 1, y) == "#" or at(x + 1, y) == "#") and (at(x, y - 1) == "#" or at(x, y + 1) == "#")
            if k == "#" or (round_ and corner):
                row += mortar
            elif at(x - 1, y) == "#" or at(x, y - 1) == "#":
                row += hi
            elif at(x + 1, y) == "#" or at(x, y + 1) == "#":
                row += sh
            else:
                row += base
        out.append(row)
    out = speckle(out, tones[2], tones[1], speck, seed)
    if moss:
        # 줄눈에 낀 이끼(줄눈 픽셀 일부를 이끼색으로)
        g = [list(r) for r in out]
        for y in range(T):
            for x in range(T):
                if at(x, y) == "#" and noise(x, y, seed + 7) < moss:
                    g[y][x] = c("moss.base") if noise(x, y, seed + 8) < 0.6 else c("moss.hi")
        out = ["".join(r) for r in g]
    return out


# 광장: 따뜻한 회색(바랜 나무색 램프 plank의 밝은 쪽) 판석. 넓게 깔리므로 대비를 낮춘다
PLAZA_STONE = _slabs(_PLAZA_LAYOUT, ("plank.base", "plank.hi", "cream.base", "cream.hi"), 41, moss=0.10, speck=0.05)
# 판석 하나에 금 간 자국과 바랜 점
for _x, _y in ((7, 2), (8, 1)):
    _set(PLAZA_STONE, _x, _y, c("plank.base"))
_set(PLAZA_STONE, 2, 7, c("cream.spec"))


# ── 바닥: 물(애니메이션 3프레임) ────────────────────────────────────────────────
def water(frame=0):
    """물: 기본색 바탕, 짧은 물결(밝음 2~3px + 바로 아래 그늘)이 프레임마다 오른쪽으로 2px 흐르고,
    강조 반짝임 1px이 프레임마다 다른 자리에서 빛난다. 멈춘 마을이라 물결은 느리고 작게."""
    base, hi, sh, sp = c("water.base"), c("water.hi"), c("water.shade"), c("water.spec")
    g = _grid(lambda x, y: base)
    # 깊은 곳 얼룩(움직이지 않는 바닥 그늘)
    for x, y in ((6, 6), (7, 6), (13, 1), (2, 10), (3, 10), (10, 13)):
        _set(g, x, y, sh)
    for x, y, n in ((1, 2, 3), (9, 4, 2), (4, 8, 3), (12, 10, 3), (1, 13, 2), (8, 14, 2)):
        x += frame * 2
        for k in range(n):
            _set(g, x + k, y, hi)
            _set(g, x + k, y + 1, sh)
    sx, sy = ((6, 11), (13, 7), (3, 5))[frame % 3]
    _set(g, sx, sy, sp)
    return g


WATER = water(0)
WATER_A1 = water(1)
WATER_A2 = water(2)


# ── 물체: 우물(물기둥이 솟다가 멈춘 채 떠 있다) ─────────────────────────────────
_WELL = paint("""
    .......T........
    ....t..W..t.....
    ......kWk.......
    .......W...T....
    ......kWk.......
    ...hHHHWHHHh....
    ..hssvvwwvvssh..
    ..Hsvvvvvvvvss..
    ..dhssssssssd...
    ..sHsdHssdHsd...
    ..ssdsssdssdd...
    ..HsdHsdsHsdd...
    ..ssdsssdssdd...
    ..ddmdddddmdd...
    ................
    ................
""", {"T": "teal.spec", "t": "teal.hi", "k": "teal.base", "W": "water.spec", "w": "water.hi", "v": "void",
      "h": "stone.hi", "H": "stone.hi", "s": "stone.base", "d": "stone.shade", "m": "moss.base"}, T, T)
WELL = _shadow(auto_outline(_WELL, skip=(c("teal.spec"), c("teal.hi"))), 14, 2, 13)


# ── 물체: 나무·덤불 ─────────────────────────────────────────────────────────────
def _tree():
    canopy = foliage([(5, 6, 5), (11, 5, 5), (8, 3, 4), (8, 8, 5)], "leaf", seed=3, dark_ramp="leaf",
                     specs=((4, 3), (9, 1), (12, 3)))
    # 밝은 풀색 잎 송이(레퍼런스의 연두 잎)를 위쪽에 몇 개
    for x, y in ((3, 4), (4, 4), (7, 1), (8, 1), (11, 2), (12, 2), (5, 7), (10, 6)):
        if canopy[y][x] != ".":
            _put(canopy, x, y, c("grass.base"))
    for x, y in ((4, 3), (8, 0), (12, 1)):
        if canopy[y][x] != ".":
            _put(canopy, x, y, c("grass.hi"))
    trunk = paint("""
        ................
        ................
        ................
        ................
        ................
        ................
        ................
        ................
        ................
        ................
        ................
        ................
        .......hbd......
        .......hbd......
        ......hbbdd.....
        ................
    """, {"h": "wood.hi", "b": "wood.base", "d": "wood.shade"}, T, T)
    g = overlay(trunk, canopy)
    g = auto_outline(g)
    return _shadow(g, 15, 4, 12)


TREE = _tree()


def _bush():
    g = foliage([(5, 10, 4), (10, 9, 4), (8, 11, 4)], "grass", seed=9, dark_ramp="leaf",
                specs=((4, 8), (9, 7)))
    g = auto_outline(g)
    return _shadow(g, 15, 3, 12)


BUSH = _bush()


# ── 바닥: 집 벽·지붕 ─────────────────────────────────────────────────────────────
def house_wall(seed=61):
    """집 앞면: 처마 그늘 2px, 크림 회벽(얼룩·녹 물때), 왼쪽 나무 기둥, 아래 나무 문턱 + 돌 기초."""
    rows = []
    for y in range(T):
        row = ""
        for x in range(T):
            if y <= 1:
                ch = c("brick.ol") if y == 0 else c("cream.ol")          # 처마 그림자
            elif y == 2:
                ch = c("cream.shade")
            elif y <= 11:
                ch = c("cream.base")
            elif y == 12:
                ch = c("wood.hi")                                        # 문턱 나무
            elif y == 13:
                ch = c("wood.shade")
            else:
                ch = c("stone.base") if y == 14 else c("stone.shade")    # 돌 기초
            if 2 <= y <= 13 and x in (0, 1):
                ch = c("wood.base") if x == 0 else c("wood.shade")      # 기둥
            row += ch
        rows.append(row)
    g = speckle(rows, "cream.base", "cream.shade", 0.05, seed)
    g = speckle(g, "cream.base", "cream.hi", 0.03, seed + 1)
    # 녹 물때(위는 녹 밝음, 아래로 옅게)
    for x, n in ((9, 4),):
        _set(g, x, 3, c("rust.hi"))
        for k in range(1, n):
            if k % 2 == 1:
                _set(g, x, 3 + k, c("cream.shade"))
    # 기초 돌 이음새
    for x in (5, 11):
        _set(g, x, 14, c("stone.ol"))
    for x in (2, 8, 14):
        _set(g, x, 15, c("stone.ol"))
    _set(g, 0, 3, c("wood.hi"))
    return g


HOUSE_WALL = house_wall()


def house_roof(seed=71, ramp="brick"):
    """지붕: 골함석(레퍼런스의 골진 금속판)을 위에서 본 모습. 골은 4px마다(밝음 1 · 기본 2 · 그늘 1)
    세로로 흘러내리고, 판이 겹치는 아래 끝(15행)은 외곽선 색 + 그 위 그늘 1줄. 녹 물때가 판 위쪽에서
    아래로 건너뛰며 흐르고, 바랜 점이 앉았다."""
    ol, sh, base, hi = (c(f"{ramp}.{s}") for s in ("ol", "shade", "base", "hi"))
    g = []
    for y in range(T):
        row = ""
        for x in range(T):
            xx = x % 4
            if y == 15:
                ch = ol
            elif y == 14:
                ch = sh if xx != 0 else base
            elif y == 0:
                ch = hi if xx in (0, 1) else base       # 위 판 아래로 막 나온 겹친 끝
            else:
                ch = (hi, base, base, sh)[xx]
            row += ch
        g.append(row)
    g = speckle(g, f"{ramp}.base", f"{ramp}.shade", 0.05, seed)
    g = speckle(g, f"{ramp}.base", "cream.hi", 0.015, seed + 1)
    # 녹 물때: 판 위쪽 못 자리에서 아래로
    for x, n in ((6, 7), (13, 4)):
        _set(g, x, 1, c("rust.hi"))
        for k in range(1, n):
            if k < 3 or k % 2 == 0:
                _set(g, x, 1 + k, c("rust.base") if k < 3 else c(f"{ramp}.shade"))
    for x in (2, 10):
        _set(g, x, 1, c("cream.hi"))                       # 못
    return g


HOUSE_ROOF = house_roof()

HOUSE_DOOR = overlay(HOUSE_WALL, paint("""
    ................
    ................
    .....oooooo.....
    ....ohbbbbdo....
    ...ohbbbbbbdo...
    ...ohbdbbdbdo...
    ...ohbdbbdbdo...
    ...ohbdbbdbdo...
    ...ohbdbbdyYo...
    ...ohbdbbdyyo...
    ...ohbdbbdbdo...
    ...ohbdbbdbdo...
    ...ohbdbbdbdo...
    ..oSSSSSSSSSSo..
    ..oDDDDDDDDDDo..
    ................
""", {"o": "wood.ol", "h": "wood.hi", "b": "wood.base", "d": "wood.shade", "y": "brass.base", "Y": "brass.spec",
      "S": "stone.hi", "D": "stone.shade"}, T, T))
# 문 위 청록 문패(메아리 마을 표식)
_set(HOUSE_DOOR, 7, 1, c("teal.base"))
_set(HOUSE_DOOR, 8, 1, c("teal.hi"))

HOUSE_WINDOW = overlay(HOUSE_WALL, paint("""
    ................
    ................
    ...oooooooooo...
    ...oSSSoSSSSo...
    ...oSkksSsssO...
    ...oSkssSsssO...
    ...ooooooooooO..
    ...oSsssSsskO...
    ...oSsssSskkO...
    ...oooooooooo...
    ..oWWWWWWWWWWo..
    ..ofgfFgfgFfgo..
    ..oddddddddddo..
    ...oooooooooo...
    ................
    ................
""", {"o": "wood.ol", "O": "wood.shade", "S": "sky.hi", "s": "sky.base", "k": "sky.spec", "W": "wood.hi",
      "d": "wood.shade", "f": "flower.hi", "F": "lamp.hi", "g": "leaf.base"}, T, T))


# ── 물체: 울타리 ─────────────────────────────────────────────────────────────────
_FENCE = paint("""
    ................
    ................
    ................
    ................
    ..hb......hb....
    ..hbd.....hbd...
    HHhbdHHHHHhbdHHH
    bbhbdbbbbbhbdbbb
    ddhbddddddhbdddd
    ..hbd.....hbd...
    HHhbdHHHHHhbdHHH
    bbhbdbbbbbhbdbbb
    ddhbddddddhbdddd
    ..hbd.....hbd...
    ................
    ................
""", {"h": "wood.hi", "H": "wood.hi", "b": "wood.base", "d": "wood.shade"}, T, T)
FENCE = auto_outline(_FENCE)
FENCE = _shadow(FENCE, 15, 2, 4)
FENCE = _shadow(FENCE, 15, 10, 12)


# ── 바닥: 돌벽·돌바닥·나무 바닥·계단 ────────────────────────────────────────────
def bricks(bw, bh, offset, ramp, seed, fill="base", moss=0.0):
    """가장자리가 이어지는 벽돌 무늬. 줄눈 = ramp.ol, 벽돌마다 위·왼쪽 밝음, 아래·오른쪽 그늘."""
    ol, sh, base, hi = (c(f"{ramp}.{s}") for s in ("ol", "shade", "base", "hi"))
    if fill == "shade":
        sh, base, hi = c(f"{ramp}.ol"), sh, base
    g = []
    for y in range(T):
        band, yy = divmod(y, bh)
        row = ""
        for x in range(T):
            xx = (x + band * offset) % bw
            if yy == bh - 1 or xx == bw - 1:
                ch = ol
            elif yy == 0 or xx == 0:
                ch = hi
            elif yy == bh - 2 and xx >= bw // 2:
                ch = sh
            else:
                ch = base
            row += ch
        g.append(row)
    return g


def wall_stone(seed=81):
    """골목 돌벽(벽 덩어리): 바닥 돌보다 한 단계 어두운 청회 벽돌, 줄눈 사이 이끼."""
    g = bricks(8, 4, 4, "stone", seed, fill="shade")
    g = speckle(g, "stone.shade", "stone.ol", 0.05, seed)
    g = speckle(g, "stone.shade", "moss.shade", 0.03, seed + 1)
    for x, y in ((3, 1), (12, 9)):
        _set(g, x, y, c("stone.hi"))
    return g


WALL_STONE = wall_stone()


# 골목 자갈: 손으로 배치한 작은 돌(먼지빛 분홍 흙 사이)
_COBBLE_LAYOUT = """
aaa#bbbbb#cccc#a
aaa#bbbbb#cccc#a
aaa#bbbbb#cccc#a
################
dd#eeee#fff#gggg
dd#eeee#fff#gggg
dd#eeee#fff#gggg
dd#eeee#fff#gggg
################
hhhhh#iii#jjjj#h
hhhhh#iii#jjjj#h
hhhhh#iii#jjjj#h
################
kk#lll#mmmmm#nnn
kk#lll#mmmmm#nnn
################
"""


def floor_stone(seed=91):
    """골목 바닥: 크기가 다른 먼지빛 분홍 자갈(레퍼런스의 분홍 땅 판), 모서리를 깎아 둥글게, 틈에 이끼 조금."""
    return _slabs(_COBBLE_LAYOUT, ("soil.shade", "soil.base", "soil.hi", "soil.spec"), seed, moss=0.06, speck=0.06,
                  round_=True)


FLOOR_STONE = floor_stone()


def floor_wood(seed=101):
    """나무 마루: 가로 널 4장(한 장 4px), 널 끝 이음새가 줄마다 어긋남, 옹이·결."""
    g = []
    for y in range(T):
        band, yy = divmod(y, 4)
        row = ""
        for x in range(T):
            seam = (x + band * 5) % 16 == 0
            if yy == 3:
                ch = c("wood.ol")
            elif seam:
                ch = c("wood.ol")
            elif yy == 0:
                ch = c("wood.hi")
            else:
                ch = c("wood.base")
            row += ch
        g.append(row)
    g = speckle(g, "wood.base", "wood.shade", 0.08, seed)
    _set(g, 6, 1, c("wood.ol"))
    _set(g, 12, 9, c("wood.ol"))
    return g


FLOOR_WOOD = floor_wood()


def stairs():
    """돌계단: 한 칸에 계단 4단(디딤면 밝음 → 기본 → 챌면 그늘 → 이음새), 가로로 이어진다."""
    g = []
    for y in range(T):
        yy = y % 4
        ch = (c("stone.hi"), c("stone.base"), c("stone.shade"), c("stone.ol"))[yy]
        g.append(ch * T)
    g = speckle(g, "stone.base", "stone.shade", 0.10, 111)
    g = speckle(g, "stone.hi", "stone.base", 0.08, 112)
    _set(g, 4, 1, c("moss.base"))
    _set(g, 13, 9, c("moss.base"))
    return g


STAIRS = stairs()


def clocktower_wall(seed=121):
    """시계탑 벽: 크림 마름돌(8×4) + 칸마다 아치 창(멈춘 시간의 청록 빛)과 황동 창턱.
    여러 칸이 모이면 창이 줄지어 선 탑의 앞면이 된다."""
    g = bricks(8, 4, 4, "cream", seed)
    g = speckle(g, "cream.base", "cream.shade", 0.06, seed)
    # 좁은 화살 창(어두운 유리에 청록 빛 한 점) + 크림 창턱. 탑 앞면에 줄지어 서도 조용하게
    win = paint("""
        ................
        ................
        ................
        .......oo.......
        ......otko......
        ......okko......
        ......okko......
        ......okko......
        ......hhhh......
        ................
        ................
        ................
        ................
        ................
        ................
        ................
    """, {"o": "cream.shade", "t": "teal.base", "k": "teal.ol", "h": "cream.hi"}, T, T)
    g = overlay(g, win)
    _set(g, 7, 9, c("rust.hi"))                         # 창턱 아래 녹 물때
    _set(g, 7, 11, c("cream.shade"))
    return g


CLOCKTOWER_WALL = clocktower_wall()

CLOCKTOWER_DOOR = overlay(CLOCKTOWER_WALL, paint("""
    .....oooooo.....
    ....oYyyyyYo....
    ...oyYtTTtYyo...
    ...oyytkktyyo...
    ...ooyYyyYyoo...
    ..oyoooooooooy..
    ..oyhbbbbbbdyo..
    ..oyhbdbbdbdyo..
    ..oyhbdbbdbdyo..
    ..oyhbdbbdbdyo..
    ..oyhbdbbdtdyo..
    ..oyhbdbbdbdyo..
    ..oyhbdbbdbdyo..
    ..oyhbdbbdbdyo..
    ..oYyyyyyyyyyo..
    ..oooooooooooo..
""", {"o": "brass.ol", "Y": "brass.hi", "y": "brass.base", "t": "teal.hi", "T": "teal.spec", "k": "teal.base",
      "h": "wood.hi", "b": "wood.base", "d": "wood.shade"}, T, T))


# ── 물체: 가로등·상자·노점·화단 ─────────────────────────────────────────────────
_LAMP = paint("""
    ......oo........
    .....yYyy.......
    ....yLLLLy......
    ....yLSLLy......
    ....yLLLly......
    .....yyyy.......
    ......hd........
    ......hd........
    ......hd........
    ......hd........
    ......hd........
    ......hd........
    .....hhdd.......
    .....pppp.......
    ................
    ................
""", {"o": "brass.shade", "Y": "brass.hi", "y": "brass.base", "L": "lamp.hi", "l": "lamp.base", "S": "lamp.spec",
      "h": "plank.base", "d": "plank.shade", "p": "plank.shade"}, T, T)
LAMP_POST = _shadow(auto_outline(_LAMP), 14, 4, 10)
LAMP_POST = _shadow(LAMP_POST, 15, 5, 9)

_CRATE = paint("""
    ................
    ................
    ................
    .HHHHHHHHHHHHH..
    .hbbbbbbbbbbbd..
    .hbXbbbbbbbXbd..
    .hbbXbbbbbXbbd..
    .HHHHHHHHHHHHH..
    .hbbbbXbbXbbbd..
    .hbbbbbXXbbbbd..
    .hbbbbXbbXbbbd..
    .hbbbXbbbbXbbd..
    .hbbXbbbbbbXbd..
    .ddddddddddddd..
    ................
    ................
""", {"H": "wood.hi", "h": "wood.hi", "b": "wood.base", "d": "wood.shade", "X": "wood.shade"}, T, T)
_CRATE = speckle(_CRATE, "wood.base", "wood.shade", 0.05, 131)
for _x, _y in ((2, 4), (12, 4), (2, 12), (12, 12)):
    _put(_CRATE, _x, _y, c("cream.hi"))
CRATE = _shadow(auto_outline(_CRATE), 15, 1, 14)

_STALL = paint("""
    ................
    RRWWRRWWRRWWRRWW
    RRWWRRWWRRWWRRWW
    rrwwrrwwrrwwrrww
    .dd.dd.dd.dd.dd.
    .p............p.
    .p............p.
    .p.aA.yy.gG.u.p.
    .HHHHHHHHHHHHHH.
    .hbbbbbbbbbbbbd.
    .hbdbbbbdbbbbbd.
    .hbbbbbbbbbbbbd.
    .hbbbbbdbbbbbbd.
    .dddddddddddddd.
    ................
    ................
""", {"R": "teal.base", "r": "teal.shade", "W": "cream.hi", "w": "cream.shade", "d": "teal.ol",
      "p": "wood.shade", "a": "cloth_red.base", "A": "cloth_red.hi", "y": "lamp.base", "g": "grass.base",
      "G": "grass.hi", "u": "brass.hi", "H": "wood.hi", "h": "wood.hi", "b": "wood.base"}, T, T)
MARKET_STALL = _shadow(auto_outline(_STALL), 14, 1, 14)
MARKET_STALL = _shadow(MARKET_STALL, 15, 2, 13)


def flower_bed(frame=0):
    """나무 화분 상자에 분홍·노랑·흰 꽃. 애니메이션 프레임은 꽃송이가 1px 흔들린다."""
    leaves = paint("""
        ................
        ................
        ................
        ................
        ................
        ..g..G...g.G....
        .gGg.g..gGgg..g.
        ..gG.gg..gG..gGg
        ..ggggGggggGggg.
        ................
        ................
        ................
        ................
        ................
        ................
        ................
    """, {"g": "leaf.base", "G": "grass.base"}, T, T)
    box = paint("""
        ................
        ................
        ................
        ................
        ................
        ................
        ................
        ................
        ................
        HHHHHHHHHHHHHHHH
        hbbbbbbbbbbbbbbd
        hbbdbbbbbbbbdbbd
        dddddddddddddddd
        ................
        ................
        ................
    """, {"H": "wood.hi", "h": "wood.hi", "b": "wood.base", "d": "wood.shade"}, T, T)
    g = overlay(box, leaves)
    heads = ((3, 4, "flower"), (8, 5, "lamp"), (12, 4, "cloth_white"), (14, 6, "flower"))
    for k, (x, y, ramp) in enumerate(heads):
        dx = (1 if k % 2 == 0 else -1) if frame else 0
        x += dx
        for ddx, ddy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
            _put(g, x + ddx, y + ddy, c(f"{ramp}.hi"))
        _put(g, x, y, c("lamp.spec") if ramp != "lamp" else c("rust.base"))
    g = auto_outline(g)
    return _shadow(g, 13, 0, 15)


FLOWER_BED = flower_bed(0)
FLOWER_BED_A1 = flower_bed(1)


def dark_floor(seed=141):
    """숨겨진 방 바닥: 어두운 판석(void 줄눈), 먼지 점, 청록 반짝임 하나(멈춘 시간이 고인 곳)."""
    g = _slabs(_PLAZA_LAYOUT, ("void", "stone.ol", "stone.shade", "stone.base"), seed, speck=0.08)
    _set(g, 9, 7, c("teal.hi"))
    return g


DARK_FLOOR = dark_floor()


TILES = {
    "grass": GRASS,
    "grass_flower": GRASS_FLOWER,
    "path": PATH,
    "plaza_stone": PLAZA_STONE,
    "water": WATER,
    "well": WELL,
    "tree": TREE,
    "bush": BUSH,
    "house_wall": HOUSE_WALL,
    "house_roof": HOUSE_ROOF,
    "house_door": HOUSE_DOOR,
    "house_window": HOUSE_WINDOW,
    "fence": FENCE,
    "wall_stone": WALL_STONE,
    "floor_wood": FLOOR_WOOD,
    "floor_stone": FLOOR_STONE,
    "stairs": STAIRS,
    "clocktower_wall": CLOCKTOWER_WALL,
    "clocktower_door": CLOCKTOWER_DOOR,
    "lamp_post": LAMP_POST,
    "crate": CRATE,
    "market_stall": MARKET_STALL,
    "flower_bed": FLOWER_BED,
    "dark_floor": DARK_FLOOR,
    # 타일 애니메이션 프레임(타일셋 끝에 붙는다. manifest tileAnimations)
    "water_a1": WATER_A1,
    "water_a2": WATER_A2,
    "grass_flower_a1": GRASS_FLOWER_A1,
    "flower_bed_a1": FLOWER_BED_A1,
}

# 타일셋 끝에 붙는 애니메이션 프레임과 manifest tileAnimations(build.py가 manifest와 맞는지 검사)
TILE_ANIMATIONS = {
    "water": {"frames": ["water", "water_a1", "water_a2"], "fps": 3},
    "grass_flower": {"frames": ["grass_flower", "grass_flower_a1"], "fps": 1.5},
    "flower_bed": {"frames": ["flower_bed", "flower_bed_a1"], "fps": 1.5},
}

# 미리보기 장면에서 투명 물체 타일 밑에 깔 바닥(게임에서는 맵의 ground 레이어가 깔린다)
DECO_UNDER = {"well": "grass", "tree": "grass", "bush": "grass", "fence": "grass", "flower_bed": "grass",
              "lamp_post": "plaza_stone", "crate": "plaza_stone", "market_stall": "plaza_stone"}
