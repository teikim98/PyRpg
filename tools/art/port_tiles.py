"""지역 5(교역항) 지형 타일(16×16). manifest의 overworld 타일셋 끝에 이 순서대로 붙는다.

화풍 통일(docs/art-overhaul/style-guide.md §3·§4.4, 기준 구현 forest_tiles.py·tiles.py): 코지 팔레트(cozypal)의
이름 있는 색만 쓴다. 지역 강조색은 blue(바다 파랑) · cloth_red(깃발 빨강) · rust(녹)이고 작은 장식에만 쓴다.
- 바닥 색: 맵의 절반 가까이를 덮는 자갈길(port_cobble)은 공통 plank(따뜻한 회색) 램프. 강조 램프 셋(blue·cloth_red·rust)은
  base 채도가 높아 맵 전체 바닥으로 쓰면 강조색 15% 규칙을 넘는다(지역 7 sand와 같은 예외). 청회 stone도 그려 봤지만
  청록 바다(water)와 색상이 겹쳐 항구 전체가 차갑고 땅과 바다가 명도로만 갈렸다. 햇볕에 바랜 따뜻한 회색 돌은 바다와
  색상으로 갈리고, 나무 상자·부두와 어울리면서 명도(상자 앞판은 그늘)로 구분된다(지역 1 광장도 plank·cream).
- 바닥(port_cobble, dock_plank, harbor_water, frozen_wave, ship_deck, lighthouse_wall)은 맵의 ground 레이어라
  불투명하고 가장자리가 이어진다(무늬는 x % 16, y % 16). 외곽선 없이 줄눈·이음새만 재질의 ol·shade로.
  부두 널(wood)은 세로, 밀수선 갑판(leather, 짙은 붉은 나무)은 가로로 놓여 둘이 섞여도 구별된다.
- 물체(port_crate, crate_gap, rope_coil, port_stall, barrel, pier_post, fishing_net, ship_rail)는 deco 레이어에만
  놓이므로 배경이 투명하다(DECO_UNDER에 미리보기 바닥). 바깥 외곽선은 auto_outline(재질 ol), 발치에 반투명 그림자.
- 창고 거리의 상자 벽(port_crate)은 맵을 덮는 벽이라 바닥보다 한 단계 어둡고, 한 칸 안에 크기·재질이 다른 상자
  둘(앞 왼쪽 큰 나무 상자 + 뒤 오른쪽 바랜 회색 상자)을 겹쳐 '상자 하나 × 격자'로 읽히지 않게 한다(§4.4 숲 벽과 같은 방식).
  상자 사이로 비치는 바닥은 상자 그늘로 덮는다.
- 숨겨진 길 crate_gap: port_crate와 같은 그림에 앞 상자의 뚜껑 널 한 장과 앞판 한 장이 빠져 속의 어둠이 보인다.
  멀리서는 상자 벽, 자세히 보면 빈 껍데기(명세: '밧줄 더미 바로 북쪽의 빈 상자').
- 얼어붙은 파도(frozen_wave)는 흐르는 바다(water)와 다른 램프(sky)로 말려 오르다 굳은 물결, 공중에 멈춘 물방울.
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


# ── 바닥: 자갈길(청회 돌) ────────────────────────────────────────────────────────
# 크기가 다른 둥근 돌을 손으로 배치(가장자리를 넘어 감긴다). 같은 글자 = 돌 한 장, '#' = 줄눈
_COBBLE_LAYOUT = """
aaaa#bbbbb#ccc#a
aaaa#bbbbb#ccc#a
aaaa#bbbbb#ccc#a
################
ee#ffff#gggggg#e
ee#ffff#gggggg#e
ee#ffff#gggggg#e
################
hhhhh#iii#jjjjj#
hhhhh#iii#jjjjj#
hhhhh#iii#jjjjj#
hhhhh#iii#jjjjj#
################
k#llllll#mmm#nnk
k#llllll#mmm#nnk
################
"""


FLOOR = "plank"


def port_cobble(seed=511):
    """항구 자갈길: 바랜 회색 돌(plank.base) + 윗가장자리 밝음, 모서리를 깎은 줄눈(plank.shade).
    줄눈에 따뜻한 모래알(sand.shade)이 드문드문 끼고, 돌 위에 닳은 얼룩. 맵의 절반 가까이를 덮어서 대비를 낮게
    (spec 없음, 아래·오른쪽 그늘 가장자리 없이 줄눈이 그늘 역할)."""
    rows = _COBBLE_LAYOUT.strip().splitlines()

    def at(x, y):
        return rows[y % T][x % T]

    mortar, base, hi = c(f"{FLOOR}.shade"), c(f"{FLOOR}.base"), c(f"{FLOOR}.hi")
    out = []
    for y in range(T):
        row = ""
        for x in range(T):
            k = at(x, y)
            corner = (at(x - 1, y) == "#" or at(x + 1, y) == "#") and (at(x, y - 1) == "#" or at(x, y + 1) == "#")
            if k == "#" or corner:
                row += mortar
            elif at(x, y - 1) == "#" and noise(x, y, seed) < 0.75:     # 윗가장자리만 밝게(빛은 왼쪽 위)
                row += hi
            elif at(x - 1, y) == "#" and at(x, y - 1) != "#" and noise(x, y, seed + 1) < 0.35:
                row += hi
            else:
                row += base
        out.append(row)
    out = speckle(out, f"{FLOOR}.base", f"{FLOOR}.shade", 0.025, seed + 2)
    g = [list(r) for r in out]
    for y in range(T):                                                  # 줄눈에 낀 모래알
        for x in range(T):
            if at(x, y) == "#" and noise(x, y, seed + 3) < 0.10:
                g[y][x] = c("sand.shade")
    return ["".join(r) for r in g]


PORT_COBBLE = port_cobble()


# ── 바닥: 부두 널(세로) ─────────────────────────────────────────────────────────
def dock_plank(seed=521):
    """부두 널: 세로로 놓인 널 네 장(한 장 4px = 밝은 왼쪽 가장자리 1 + 기본 2 + 틈 1). 널 사이 틈은 아래 물그늘
    (wood.ol), 널 끝 이음새는 널마다 다른 줄, 이음새 옆에 못(plank.hi), 결(그늘 점)과 옹이."""
    joints = (3, 11, 6, 14)
    g = []
    for y in range(T):
        row = ""
        for x in range(T):
            p, xx = divmod(x, 4)
            if xx == 3:
                ch = c("wood.ol")
            elif y == joints[p]:
                ch = c("wood.shade")
            elif xx == 0:
                ch = c("wood.hi")
            else:
                ch = c("wood.base")
            row += ch
        g.append(row)
    g = speckle(g, "wood.base", "wood.shade", 0.07, seed)
    for p, j in enumerate(joints):                                      # 이음새 위·아래 못
        _set(g, p * 4 + 1, j - 1, c("plank.hi"))
        _set(g, p * 4 + 2, j + 1, c("plank.hi"))
    _set(g, 9, 2, c("wood.ol"))                                         # 옹이
    _set(g, 2, 9, c("wood.ol"))
    return g


DOCK_PLANK = dock_plank()


# ── 바닥: 밀수선 갑판(가로, 짙은 붉은 나무) ──────────────────────────────────────
def ship_deck(seed=531):
    """밀수선 갑판: 가로로 놓인 짙은 붉은 널(leather 램프) 네 장, 널 사이 줄은 ol, 위 가장자리 밝음,
    널 끝 이음새는 줄마다 어긋나고 이음새 옆에 나무못(leather.spec 1px). 부두 널보다 어둡고 붉다."""
    seams = (9, 2, 13, 6)
    g = []
    for y in range(T):
        band, yy = divmod(y, 4)
        row = ""
        for x in range(T):
            if yy == 3 or x == seams[band]:
                ch = c("leather.ol")
            elif yy == 0:
                ch = c("leather.base")
            else:
                ch = c("leather.shade")
            row += ch
        g.append(row)
    g = speckle(g, "leather.shade", "leather.ol", 0.06, seed)
    for band, s in enumerate(seams):
        _set(g, s + 2, band * 4 + 1, c("leather.hi"))
    return g


SHIP_DECK = ship_deck()


# ── 바닥: 바다 ──────────────────────────────────────────────────────────────────
def harbor_water():
    """바다: 물 기본색 바탕에 짧은 물결(밝음 2~4px + 바로 아래 그늘), 깊은 곳 얼룩, 반짝임 1px.
    지역 1 물과 같은 규칙(water 램프)이라 경계 장식 분류 water(흰 물거품)가 그대로 맞는다."""
    base, hi, sh, sp = c("water.base"), c("water.hi"), c("water.shade"), c("water.spec")
    g = _grid(lambda x, y: base)
    for x, y in ((5, 5), (6, 5), (14, 2), (1, 11), (2, 11), (11, 14)):
        _set(g, x, y, sh)
    for x, y, n in ((1, 1, 3), (9, 3, 4), (4, 7, 3), (12, 9, 3), (0, 13, 2), (7, 12, 3)):
        for k in range(n):
            _set(g, x + k, y, hi)
            _set(g, x + k + 1, y + 1, sh)
    _set(g, 13, 6, sp)
    return g


HARBOR_WATER = harbor_water()


# ── 바닥: 얼어붙은 파도 ─────────────────────────────────────────────────────────
_WAVE = """
................
...........w....
......hhs.......
....hhbbbh...s..
...hbbbbbbh.....
..hbbboooobh....
..hbbo....bo....
.hbbo......o....
.hbbo...........
.hbbo...........
hbbbo.......hs..
hbbbbo....hhbbh.
bbbbbbo.hhbbbbbo
obbbbbbobbbbbboo
.ooooooooooooo..
................
"""


def frozen_wave():
    """바다 위에서 말려 오르다 유리처럼 굳은 파도(sky 램프, 흐르는 물과 다른 색): 물마루 위 밝음과 강조, 말린 안쪽
    그늘, 오른쪽에 작은 둘째 물결. 공중에 멈춘 물방울 둘(흰 점·강조). 애니메이션 없음(멈춘 시간)."""
    legend = {"o": "sky.shade", "b": "sky.base", "h": "sky.hi", "s": "sky.spec", "w": "white"}
    drops = {(x, y) for y, ln in enumerate(_WAVE.strip().splitlines()) for x, ch in enumerate(ln.strip())
             if ch in "sw" and y in (1, 3)}
    p = Px()
    p.rows(_WAVE, legend)
    for x, y in drops:                                                  # 떠 있는 물방울은 외곽선 없이 나중에 찍는다
        p.put(x, y, None)
    g = p.grid()
    for x, y in drops:
        _put(g, x, y, c("white" if y == 1 else "sky.spec"))
    base = list(HARBOR_WATER)
    for x in range(1, 15):                                              # 물에 비친 파도 그늘
        if g[15][x] == ".":
            _put(base, x, 15, c("water.shade"))
    return _under(base, g)


FROZEN_WAVE = frozen_wave()


# ── 바닥: 등대 벽 ───────────────────────────────────────────────────────────────
def lighthouse_wall():
    """등대 벽: 위 반은 흰 회벽 돌(cream), 아래 반은 빨간 띠 돌(cloth_red 그늘 쪽, 깃발 빨강 강조). 엇갈린 8×4 돌,
    줄눈은 그 재질의 그늘, 돌마다 위·왼쪽 밝음. 세로로 쌓으면 흰·빨강 줄무늬 탑이 된다. 띠 경계와 아래 끝은 짙은 줄."""
    g = []
    for y in range(T):
        red = y >= 8
        band, yy = divmod(y, 4)
        row = ""
        for x in range(T):
            xx = (x + (4 if band % 2 else 0)) % 8
            if red:
                ol, hi, base = "cloth_red.ol", "cloth_red.base", "cloth_red.shade"
            else:
                ol, hi, base = "cream.shade", "cream.hi", "cream.base"
            if yy == 3 or xx == 7:
                ch = ol
            elif yy == 0 or xx == 0:
                ch = hi
            else:
                ch = base
            row += c(ch)
        g.append(row)
    g = speckle(g, "cream.base", "cream.shade", 0.05, 541)
    g = speckle(g, "cloth_red.shade", "cloth_red.ol", 0.05, 542)
    g[7] = c("cream.ol") * T
    g[15] = c("cloth_red.ol") * T
    # 소금기에 녹 물때 하나(흰 벽에 rust.hi 1px + 아래로 건너뛰며 cream.shade)
    _set(g, 11, 1, c("rust.hi"))
    _set(g, 11, 3, c("cream.shade"))
    _set(g, 11, 5, c("cream.shade"))
    return g


LIGHTHOUSE_WALL = lighthouse_wall()


# ── 물체: 화물 상자 벽 ──────────────────────────────────────────────────────────
_DOWN = {"ol": "ol", "shade": "ol", "base": "shade", "hi": "base", "spec": "hi"}


def _darken(p, cells, keep=()):
    """벽 물체를 바닥보다 한 단계 어둡게(style-guide §3.4): 그 칸들의 단계를 하나씩 내린다(hi→base, base→shade …)."""
    for x, y in cells:
        n = p.get(x, y)
        if n and "." in n and n not in keep:
            r, s = n.split(".")
            p.put(x, y, f"{r}.{_DOWN[s]}")


def _crates(gap=False):
    """창고 거리의 짐 더미 한 칸: 뒤에 삼베 자루 둘(sand, 파란 스텐실 표식), 앞 왼쪽에 큰 나무 상자(밝은 뚜껑 +
    그늘진 앞판에 X자 버팀목, 녹슨 쇠 귀퉁이). 둥근 자루와 네모 상자를 비대칭으로 겹쳐 벽돌담처럼 반복되지 않게 하고,
    자루는 한 단계, 상자 앞판은 그늘로 칠해 바닥보다 어둡게 둔다. gap이면 앞 상자의 뚜껑 널 한 장과 앞판 한 장이
    빠져 속의 어둠(void)이 보인다."""
    p = Px()
    # 뒤: 삼베 자루 둘(왼쪽 위 작은 것이 더 뒤, 오른쪽 큰 것이 앞)
    sack_b = ellipse(5.5, 3.2, 4.2, 3.0)
    sack_f = ellipse(11.8, 5.4, 4.0, 4.6)
    for sack in (sack_b, sack_f):
        p.mass(sack, "sand")
        _darken(p, sack)
    for x, y in sack_f:                                                 # 앞 자루 테두리(뒤 자루와 갈라지게)
        if (x - 1, y) in sack_b - sack_f or (x, y - 1) in sack_b - sack_f:
            p.put(x, y, "sand.ol")
    for x, y in ((11, 1), (12, 1), (12, 0), (5, 0)):                    # 자루 아가리를 묶은 끈
        p.put(x, y, "wood.shade")
    p.put(11, 0, "wood.base")
    for x, y in ((13, 5), (14, 5), (13, 6)):                            # 파란 스텐실 표식(강조 blue, 3px)
        p.put(x, y, "blue.shade")
    # 앞: 나무 상자 x 0..13, y 6..14(뚜껑 6~7, 뚜껑 턱 8, 앞판 9~13에 '/' 버팀목)
    F = """
    HHHHHHHHHHHHHs
    hbbbsbbbbsbbbs
    oooooooooooooo
    hssssssssssBBs
    hssssssssBBsss
    hsssssBBssssss
    hssBBsssssssss
    hBBsssssssssss
    dddddddddddddd
    """
    legend = {"H": "wood.hi", "h": "wood.base", "b": "wood.base", "d": "wood.ol", "o": "wood.ol",
              "s": "wood.shade", "B": "wood.base"}
    p.rows(F, legend, 0, 6)
    for x, y in ((0, 9), (13, 9), (0, 13), (13, 13)):                   # 녹슨 쇠 귀퉁이(강조 rust)
        p.put(x, y, "rust.shade")
    p.put(1, 9, "rust.base")
    for x in range(0, 15):                                              # 상자 위 테두리(자루와 갈라지게)
        if p.get(x, 5):
            p.put(x, 5, "wood.ol")
    for y in range(5, 15):
        if p.get(14, y):
            p.put(14, y, "wood.ol")
    if gap:
        for x in range(5, 9):                                           # 빠진 뚜껑 널(속의 어둠)
            p.put(x, 7, "void")
        for x in range(2, 10):                                          # 빠진 앞판 한 장
            p.put(x, 11, "void")
    g = p.grid()
    # 짐 사이로 비치는 바닥은 짐 그늘: 위쪽은 옅은 그늘, 아래쪽(8행부터)은 짙은 그림자
    sh, soft = c("shadow"), c("shadow_soft")
    return ["".join((sh if y >= 8 else soft) if ch == "." else ch for ch in row) for y, row in enumerate(g)]


PORT_CRATE = _crates()
CRATE_GAP = _crates(gap=True)


# ── 물체: 밧줄 더미(숨겨진 길 표지) ──────────────────────────────────────────────
def rope_coil():
    """자갈길 위에 둥글게 감아 둔 굵은 삼베 밧줄(sand 램프): 바퀴마다 위 밝음·아래 그늘 홈, 가운데 구멍, 오른쪽 아래로
    풀린 끝. 밟을 수 있는 낮은 장식이라 발치 그림자를 얇게."""
    p = Px()
    coil = ellipse(7.5, 8.5, 6.4, 4.6)
    p.mass(coil, "sand", shade_below=12)
    cx, cy = 7.5, 8.5
    for x, y in coil:                                                   # 감긴 홈(그늘 고리 둘)
        r = ((x + 0.5 - cx) / 6.4) ** 2 + ((y + 0.5 - cy) / 4.6) ** 2
        if 0.42 < r < 0.62 or 0.12 < r < 0.22:
            p.put(x, y, "sand.shade")
        elif r <= 0.12:
            p.put(x, y, "sand.ol")                                      # 가운데 구멍
    for x, y in ((4, 6), (5, 5), (9, 7), (3, 9)):                       # 꼬임 결(밝음)
        if p.get(x, y) in ("sand.base", "sand.hi"):
            p.put(x, y, "sand.hi")
    p.put(5, 5, "sand.spec")
    for x, y in ((13, 11), (14, 12), (14, 13), (15, 13)):              # 풀린 끝
        p.put(x, y, "sand.base")
    p.put(13, 12, "sand.shade")
    p.put(15, 12, "sand.hi")
    g = p.grid()
    return _shadow(g, 14, 2, 12)


ROPE_COIL = rope_coil()


# ── 물체: 생선 좌판 ─────────────────────────────────────────────────────────────
_STALL = """
................
BBWWBBWWBBWWBBWW
BBWWBBWWBBWWBBWW
kkwwkkwwkkwwkkww
.nn.nn.nn.nn.nn.
.p............p.
.p.iIIIIIIiiI.p.
.p.iFFfiRrIii.p.
.p.ffFeiirRii.p.
.HHHHHHHHHHHHHH.
.hbbbbbbbbbbbbd.
.hbdbbbbbdbbbbd.
.hbbbbbbbbbbbbd.
.hbbbbdbbbbbbbd.
.dddddddddddddd.
................
"""


def port_stall():
    """생선 좌판: 파랑·흰 줄무늬 차양(강조 blue, 옆 칸과 무늬가 이어진다)과 짙은 파랑 술, 나무 기둥, 얼음(sky) 위에
    은빛 생선과 녹빛 게, 나무 판매대. 지역 1 market_stall과 같은 구성이라 상점 줄로 읽힌다."""
    legend = {"B": "blue.base", "k": "blue.shade", "n": "blue.ol", "W": "cream.hi", "w": "cream.shade",
              "p": "wood.shade", "i": "sky.hi", "I": "sky.spec", "F": "stone.hi", "f": "stone.base", "e": "eye",
              "R": "rust.hi", "r": "rust.base", "H": "wood.hi", "h": "wood.hi", "b": "wood.base", "d": "wood.shade"}
    p = Px()
    p.rows(_STALL, legend)
    g = p.grid()
    return _shadow(g, 15, 1, 15)


PORT_STALL = port_stall()


# ── 물체: 통 ────────────────────────────────────────────────────────────────────
def barrel():
    """쇠테 두 줄(녹 rust) 두른 나무 통: 위 뚜껑 타원(밝은 나무 + 테두리 그늘), 세로 널 이음새, 왼쪽 밝음·오른쪽 그늘."""
    p = Px()
    body = {(x, y) for x in range(3, 13) for y in range(4, 14)} - {(3, 4), (12, 4), (3, 13), (12, 13)}
    body |= {(2, y) for y in range(6, 12)} | {(13, y) for y in range(6, 12)}           # 배가 부른 통
    p.mass(body, "wood", shade_below=12)
    for x in (5, 8, 11):                                                # 세로 널 이음새
        for y in range(5, 13):
            if p.get(x, y) == "wood.base":
                p.put(x, y, "wood.shade")
    for y in (6, 11):                                                   # 쇠테
        for x in range(2, 14):
            if p.get(x, y):
                p.put(x, y, "rust.shade" if x >= 10 else "rust.base")
        p.put(3, y, "rust.hi")
    lid = ellipse(7.5, 4.0, 4.6, 2.0)
    for x, y in lid:
        p.put(x, y, "wood.hi")
    for x, y in ellipse(7.5, 4.0, 3.2, 1.2):
        p.put(x, y, "wood.base")
    p.put(6, 3, "wood.spec")
    g = p.grid()
    return _shadow(g, 15, 3, 13)


BARREL = barrel()


# ── 물체: 계선주 ────────────────────────────────────────────────────────────────
def pier_post():
    """부두에 박힌 굵은 나무 기둥: 둥근 머리(나이테·위 밝음)에 굳은 물보라 서리(sky) 1px, 허리에 감긴 삼베 밧줄(sand),
    밑동 그림자."""
    p = Px()
    post = {(x, y) for x in range(5, 11) for y in range(4, 14)}
    p.mass(post, "wood", shade_below=12)
    for y in range(5, 13):                                              # 세로 결
        if y % 3 == 0:
            p.put(8, y, "wood.shade")
    head = ellipse(8, 4.0, 3.4, 1.9)
    p.mass(head, "wood", lift=1)
    p.put(8, 4, "wood.base")                                            # 나이테 심
    for y in (7, 8, 9):                                                 # 감긴 밧줄(두 바퀴 + 늘어진 끝)
        for x in range(4, 12):
            p.put(x, y, "sand.base" if (x + y) % 2 else "sand.hi")
        p.put(11, y, "sand.shade")
    p.put(4, 10, "sand.shade")
    p.put(3, 11, "sand.base")
    p.put(6, 2, "sky.hi")                                               # 서리
    g = p.grid()
    return _shadow(g, 14, 4, 12)


PIER_POST = pier_post()


# ── 물체: 그물 ──────────────────────────────────────────────────────────────────
def fishing_net():
    """두 기둥 사이 가로대에 걸어 말리는 그물: 나무 틀(외곽선), 마름모 그물 눈(크림 줄, 외곽선 없이 사이로 부두 널이
    비침, 아래로 처질수록 어둡게), 아래 끝 빨강·흰 찌(강조 cloth_red), 가운데 걸린 은빛 물고기."""
    p = Px()
    for x in range(1, 15):                                              # 가로대
        p.put(x, 1, "wood.hi")
        p.put(x, 2, "wood.shade")
    for x0 in (1, 13):                                                  # 기둥
        for y in range(1, 14):
            p.put(x0, y, "wood.base" if y > 1 else "wood.hi")
            p.put(x0 + 1, y, "wood.shade")
    g = p.grid()
    for y in range(3, 12):                                              # 그물 눈
        for x in range(3, 13):
            if (x + y) % 3 == 0 or (x - y) % 3 == 0:
                _put(g, x, y, c("cream.hi" if y < 6 else "cream.base" if y < 9 else "cream.shade"))
    for x, col in ((3, "cloth_red.base"), (5, "cream.spec"), (7, "cloth_red.base"), (9, "cream.spec"),
                   (11, "cloth_red.base")):
        _put(g, x, 11, c(col))
        _put(g, x, 12, c("cloth_red.shade" if col.startswith("cloth") else "cream.shade"))
    for x, y, col in ((7, 6, "stone.hi"), (6, 7, "stone.hi"), (7, 7, "stone.base"), (8, 7, "eye"),
                      (7, 8, "stone.shade"), (5, 7, "stone.shade")):
        _put(g, x, y, c(col))
    for x in (1, 2, 13, 14):
        _put(g, x, 14, c("shadow"))
    return g


FISHING_NET = fishing_net()


# ── 물체: 배 난간 ───────────────────────────────────────────────────────────────
def ship_rail():
    """밀수선 난간(갑판과 같은 짙은 붉은 나무 leather): 굵은 위 난간대(위 밝음, 녹슨 쇠못 2개), 4px마다 난간동자,
    아래 난간대, 갑판에 떨어진 그림자. 옆으로 이으면 끊김 없이 이어진다."""
    p = Px()
    for x in range(T):
        p.put(x, 2, "leather.hi")
        p.put(x, 3, "leather.base")
        p.put(x, 4, "leather.shade")
        p.put(x, 10, "leather.base")
        p.put(x, 11, "leather.shade")
        for y in range(5, 10):
            if x % 4 == 1:
                p.put(x, y, "leather.base")
            elif x % 4 == 2:
                p.put(x, y, "leather.shade")
    for x in (3, 11):
        p.put(x, 3, "rust.base")
    g = p.grid()
    for x in range(T):
        if g[13][x] == ".":
            _put(g, x, 13, c("shadow"))
    return g


SHIP_RAIL = ship_rail()


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

# 미리보기에서 투명 물체 타일 밑에 깔 바닥(게임에서는 맵의 ground 레이어가 깔린다)
DECO_UNDER = {
    **{n: "port_cobble" for n in ("port_crate", "crate_gap", "rope_coil", "port_stall")},
    **{n: "dock_plank" for n in ("barrel", "pier_post", "fishing_net")},
    "ship_rail": "ship_deck",
}
